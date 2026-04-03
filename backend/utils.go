package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"time"

	"github.com/AlHeamer/brave-bpc/glue"
	"github.com/antihax/goesi/esi"
	"github.com/bwmarrin/snowflake"
	"github.com/gorilla/securecookie"
	"github.com/gorilla/sessions"
	"github.com/hashicorp/go-envparse"
	zaplogfmt "github.com/sykesm/zap-logfmt"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const (
	envAppId       = "ESI_APP_ID"
	envAppSecret   = "ESI_APP_SECRET"
	envAppRedirect = "ESI_APP_REDIRECT"
	envMigrateDown = "MIGRATE_DOWN"
	envEnvironment = "ENVIRONMENT"
	envHttpPort    = "HTTP_PORT"
	envJwtSkew     = "JWT_SKEW"
	envDbUser      = "DB_USER"
	envDbPass      = "DB_PASS"
	envDbHost      = "DB_HOST"
	envDbPort      = "DB_PORT"
	envDbName      = "DB_NAME"
	envInitialAllianceID      = "INITIAL_ALLIANCE_ID"
	envInitialAdminCorpID     = "INITIAL_ADMIN_CORP_ID"
	envInitialAdminCharacterID = "INITIAL_ADMIN_CHARACTER_ID"

	cookieSession = "brave-bpc-session"
	cookieUser    = "brave-bpc"
)

func newDefaultLogger(env string) *zap.Logger {
	cfg := zap.NewProductionEncoderConfig()
	cfg.EncodeTime = zapcore.ISO8601TimeEncoder

	opts := []zap.Option{
		zap.AddStacktrace(zapcore.ErrorLevel),
		zap.WithCaller(true),
		zap.Hooks(
			func(e zapcore.Entry) error {
				logCount.WithLabelValues(e.Level.String()).Inc()
				return nil
			}),
	}

	logLevel := zapcore.InfoLevel
	switch env {
	case "":
		fallthrough
	case "dev":
		logLevel = zapcore.DebugLevel
		opts = append(opts, zap.Development())
	}

	logger := zap.New(
		zapcore.NewCore(
			zaplogfmt.NewEncoder(cfg),
			os.Stderr,
			logLevel,
		), opts...)

	zap.RedirectStdLog(logger)

	return logger
}

func newSnowflake(logger *zap.Logger) *snowflake.Node {
	snowflake.Epoch = time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	flake, err := snowflake.NewNode(1)
	if err != nil {
		logger.Fatal("failed to start snowflake", zap.Error(err))
	}

	return flake
}

func newSessionStore() sessions.Store {
	return sessions.NewFilesystemStore(
		os.TempDir(),
		securecookie.GenerateRandomKey(64),
		securecookie.GenerateRandomKey(32),
	)
}

func dbConnectString() string {
	user := getEnvWithDefault(envDbUser, "local")
	pass := getEnvWithDefault(envDbPass, "local")
	host := getEnvWithDefault(envDbHost, "localhost")
	port := getEnvWithDefault(envDbPort, "3308")
	name := getEnvWithDefault(envDbName, "local")

	if host[0] == '/' {
		return fmt.Sprintf("%s:%s@unix(%s)/%s?parseTime=true", user, pass, host, name)
	}

	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", user, pass, host, port, name)
}

//go:embed migrations/*.sql
var embedMigrations embed.FS

// loadEnv parses the contents of .env and sets any unset environment variables
func loadEnv(logger *zap.Logger) *runtimeConfig {
	if fp, err := os.Open("./.env"); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			logger.Info("ignoring missing .env file", zap.Error(err))
		} else {
			logger.Error("error opening .env file", zap.Error(err))
		}
	} else {
		defer fp.Close()

		env, err := envparse.Parse(fp)
		if err != nil {
			logger.Error("error parsing .env file", zap.Error(err))
		}

		for k, v := range env {
			setUnsetEnv(k, v)
		}
	}

	skewStr := getEnvWithDefault(envJwtSkew, "5m")
	skew, err := time.ParseDuration(skewStr)
	if err != nil {
		skew = 5 * time.Minute
		logger.Error("error parsing JWT_SKEW, defaulting to 5m", zap.Error(err))
	}

	return &runtimeConfig{
		appId:       os.Getenv(envAppId),
		appSecret:   os.Getenv(envAppSecret),
		appRedirect: os.Getenv(envAppRedirect),
		environment: os.Getenv(envEnvironment),
		migrateDown: os.Getenv(envMigrateDown),
		httpPort:    getEnvWithDefault(envHttpPort, "2727"),
		jwtSkew:     skew,
	}
}

// checks if an environment variable has been set.
// if it hasn't, set it with the value param
// returns the set value
func setUnsetEnv(key string, value string) {
	if _, set := os.LookupEnv(key); !set {
		os.Setenv(key, value)
	}
}

func getEnvWithDefault(key string, value string) string {
	val, set := os.LookupEnv(key)
	if set {
		return val
	}
	return value
}

func getLoggerFromContext(ctx context.Context) *zap.Logger {
	if logger, ok := ctx.Value(ctxLogger{}).(*zap.Logger); ok {
		return logger
	}
	return nil
}

func (app *app) getUserFromSession(r *http.Request) *user {
	s, _ := app.sessionStore.Get(r, cookieSession)
	if user, ok := s.Values[sessionUserData{}].(user); ok {
		return &user
	}
	return &user{}
}

// httpError creates a json formatted error message with code.
// You should return from your handler after calling this.
func httpError(w http.ResponseWriter, message string, statusCode int) {
	h := w.Header()
	h.Del("Content-Length")
	//h.Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(statusCode)
	fmt.Fprintf(w, `{"code":%d,"msg":"%s"}`, statusCode, message)
}

// httpWrite converts data to a json object and writes it to http.ResponseWriter
func httpWrite(w http.ResponseWriter, data any) {
	buf, err := json.Marshal(data)
	if err != nil {
		httpError(w, "error marshalling json", http.StatusInternalServerError)
		return
	}
	w.Write(buf)
}

func (app *app) getAdminToken(logger *zap.Logger) scopeSourcePair {
	tsps := app.dao.getTokenForCharacter(logger, app.config.AdminCharacter, []string{
		string(glue.EsiScope_AssetsReadCorporationAssets_v1),
		string(glue.EsiScope_CorporationsReadBlueprints_v1),
		string(glue.EsiScope_CorporationsReadDivisions_v1),
		string(glue.EsiScope_IndustryReadCorporationJobs_v1),
		string(glue.EsiScope_UniverseReadStructures_v1),
	})
	toks := app.createTokens(tsps)
	if len(toks) == 0 {
		return scopeSourcePair{}
	}
	return toks[0]
}

func sameBlueprintQuality(a esi.GetCorporationsCorporationIdBlueprints200Ok, b esi.GetCorporationsCorporationIdBlueprints200Ok) bool {
	return a.TypeId == b.TypeId &&
		a.MaterialEfficiency == b.MaterialEfficiency &&
		a.TimeEfficiency == b.TimeEfficiency &&
		a.Runs == b.Runs
}

func parseEsiError(err error) string {
	s := map[string]string{}
	if e, ok := err.(esi.GenericSwaggerError); ok {
		json.Unmarshal(e.Body(), &s)
	}
	return s["error"]
}
