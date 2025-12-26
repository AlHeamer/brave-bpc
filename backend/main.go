package main

import (
	"context"
	"encoding/gob"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/AlHeamer/brave-bpc/glue"
	"github.com/AlHeamer/openesi"
	"github.com/AlHeamer/openesi/esi"
	"github.com/bwmarrin/snowflake"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gorilla/sessions"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

const (
	esiUserAgent      = "brave-bpc/0.0.0 (eve:Al Heamer)"
	esiCompatDate     = "2025-08-26"
	headerPages       = "X-Pages"
	esiRequestTimeout = 20 * time.Second
)

type appConfig struct {
	AllianceWhitelist    []int64 `json:"alliances,omitempty"`     // Alliances allowed to log into this service
	CorporationWhitelist []int64 `json:"corporations,omitempty"`  // Corporations allowed to log into this service
	AdminCorp            int64   `json:"admin_corp,omitempty"`    // Corporation that provides the service
	AdminCharacter       int64   `json:"admin_char,omitempty"`    // The character used to poll corporate data
	MaxContracts         int32   `json:"max_contracts,omitempty"` // Maximum number of contracts an account can open
}

type runtimeConfig struct {
	appId       string
	appSecret   string
	appRedirect string
	environment string
	migrateDown string
	httpPort    string
	jwtSkew     time.Duration
}

type requisitionLock struct {
	LockedAt      time.Time `json:"locked_at"`
	CharacterId   int64     `json:"character_id"`
	CharacterName string    `json:"character_name"`
}

type app struct {
	config         *appConfig
	runtimeConfig  *runtimeConfig
	logger         *zap.Logger
	dao            *dao
	sessionStore   sessions.Store
	esi            *openesi.Client
	invStateLock   sync.RWMutex
	inventoryState *inventoryState

	requisitionLocks      *syncMap[int64, requisitionLock]
	flake                 *snowflake.Node
	adminTokenRefreshChan chan struct{}
}

func main() {
	logger := newDefaultLogger(os.Getenv(envEnvironment))
	defer logger.Sync()

	runtimeConfig := loadEnv(logger)
	if runtimeConfig.appId == "" || runtimeConfig.appSecret == "" || runtimeConfig.appRedirect == "" {
		logger.Fatal("ensure ESI_APP_ID, ESI_APP_SECRET, and ESI_APP_REDIRECT are set")
	}

	var err error
	app := &app{
		logger:       logger,
		sessionStore: newSessionStore(),
		flake:        newSnowflake(logger),
		invStateLock: sync.RWMutex{},
		inventoryState: &inventoryState{
			bpcs:           map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner{},
			bpos:           map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner{},
			containerNames: map[int64]string{},
			typeNames:      map[int64]string{},
			tree:           map[int64]*CorpAsset{},
		},
		requisitionLocks:      newSyncMap[int64, requisitionLock](),
		runtimeConfig:         runtimeConfig,
		adminTokenRefreshChan: make(chan struct{}, 1),
	}

	app.esi, err = openesi.NewClient(
		context.Background(),
		app.runtimeConfig.appId,
		app.runtimeConfig.appSecret,
		app.runtimeConfig.appRedirect,
		esiUserAgent,
		&http.Client{Timeout: 10 * time.Second},
		time.Second)
	if err != nil {
		logger.Fatal("error creating openesi client", zap.Error(err))
	}

	app.dao = newDao(logger)
	defer app.dao.db.Close()
	app.dao.runMigrations(logger, len(app.runtimeConfig.migrateDown) > 0)

	app.config, err = app.dao.loadAppConfig()
	if err != nil {
		logger.Fatal("failed to load config from db", zap.Error(err))
	}

	gob.Register(user{})
	gob.Register(sessionAuthType{})
	gob.Register(sessionLoginScopes{})
	gob.Register(sessionLoginSrc{})
	gob.Register(sessionLoginState{})
	gob.Register(sessionUserData{})
	gob.Register([]glue.EsiScope{})

	mux := http.NewServeMux()
	baseChain := NewMwChain(app.requestMiddleware)
	chain := baseChain.Add(app.authMiddlewareFactory(authLevel_Unauthorized))
	mux.Handle("/", chain.HandleFunc(app.root))
	mux.Handle("GET /metrics", baseChain.Add(app.metricsAuth).Handle(promhttp.Handler()))
	mux.Handle("GET /config", chain.HandleFunc(app.printConfig))

	app.createAuthHandlers(mux, baseChain)
	app.createApiHandlers(mux, baseChain)

	server := &http.Server{
		Addr:         ":" + app.runtimeConfig.httpPort,
		Handler:      mux,
		IdleTimeout:  120 * time.Second,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	threadCtx, cancelThreads := context.WithCancel(context.Background())
	go app.ticker(threadCtx)

	go func() {
		logger.Info("http service listening",
			zap.String("port", app.runtimeConfig.httpPort),
			zap.String("environment", app.runtimeConfig.environment))

		if err := server.ListenAndServe(); err != nil {
			logger.Error("error serving http", zap.Error(err))
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
	logger.Info("received os interrupt signal, shutting down gracefully")

	cancelThreads()

	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancelShutdown()

	err = server.Shutdown(shutdownCtx)
	logger.Info("shutdown complete", zap.Error(err))
}

func (app *app) root(w http.ResponseWriter, r *http.Request) {
	logger := getLoggerFromContext(r.Context())
	logger.Debug("root")
	user := app.getUserFromSession(r)

	body := `
<html>
<body>
` + fmt.Sprintf("%+v", user) + `
<ul>
<li><a href="/login">login</a>
<li><a href="/login/char">add character</a>
<li><a href="/login/scope">add scopes</a>
<li><a href="/config">config</a>
<li><a href="/metrics">metrics</a>
<li><a href="/api/blueprints">list blueprints</a>
</ul>
</body>
</html>
`
	w.Write([]byte(body))
}

// print out the app config data
func (app *app) printConfig(w http.ResponseWriter, r *http.Request) {
	logger := getLoggerFromContext(r.Context())
	logger.Debug("printConfig")
	body := `
<html>
<body>
` + fmt.Sprintf("%+v<br/>%+v", *app.config, *app.runtimeConfig) + `
<ul>
<li><a href="/login">login</a>
<li><a href="/login/char">add character</a>
<li><a href="/login/scope">add scopes</a>
<li><a href="/config">config</a>
<li><a href="/metrics">metrics</a>
</ul>
</body>
</html>
`
	w.Write([]byte(body))
}
