package main

import (
	"context"
	crand "crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/AlHeamer/brave-bpc/glue"
	"github.com/AlHeamer/openesi/esi"
	"github.com/gorilla/sessions"
	"go.uber.org/zap"
	"golang.org/x/oauth2"
)

const (
	authLevel_Unauthorized = iota
	authLevel_Authorized   = iota
	authLevel_Worker       = iota
	authLevel_Admin        = iota
)

// keys used in session.Values map
type (
	sessionLoginState  struct{} // oauth2 state
	sessionLoginSrc    struct{} // source url that we're logging in from
	sessionAuthType    struct{} // auth type new, add (character), scope
	sessionLoginScopes struct{} // scopes to grant
	sessionUserData    struct{} // user data after login
)

type user struct {
	UserId        int64  `json:"-"`
	CharacterId   int64  `json:"character_id"`
	Level         int    `json:"auth_level"`
	CharacterName string `json:"character_name"`
}

func (u *user) toJson() string {
	js, _ := json.Marshal(u)
	return base64.URLEncoding.EncodeToString(js)
}

func (u *user) IsLoggedIn() bool {
	if u != nil {
		return u.UserId > 0
	}
	return false
}

type authType string

const (
	authTypeLogin        authType = "login" // create a user if none exists (whitelist ok)
	authTypeAddCharacter authType = "add"   // link character to user
	authTypeAddScopes    authType = "scope" // add scopes to character
)

func (app *app) doLogin(w http.ResponseWriter, r *http.Request, authType authType, esiScopes ...glue.EsiScope) {
	logger := getLoggerFromContext(r.Context()).With(
		zap.String("auth_type", string(authType)),
		zap.Any("scopes", esiScopes))

	s, _ := app.sessionStore.Get(r, cookieSession)

	if code := r.URL.Query().Get("code"); code != "" {
		// if code is set, this is the callback state.
		app.callback(logger, w, r, s, code)
		return
	}

	b := make([]byte, 16)
	_, _ = crand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)

	s.Values[sessionLoginState{}] = state
	s.Values[sessionLoginSrc{}] = r.URL.Query().Get("src")
	s.Values[sessionAuthType{}] = string(authType)
	s.Values[sessionLoginScopes{}] = esiScopes

	if err := s.Save(r, w); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	stringScopes := make([]string, len(esiScopes))
	for i, scope := range esiScopes {
		stringScopes[i] = string(scope)
	}

	url := app.esi.AuthorizeUrl(state, true, stringScopes)
	http.Redirect(w, r, url, http.StatusFound)
}

type scopeSourcePair struct {
	scope string
	token oauth2.TokenSource
}

func (app *app) createTokens(tsps []scopeRefreshPair) []scopeSourcePair {
	var esiScopes []string
	for _, tsp := range tsps {
		esiScopes = append(esiScopes, tsp.scope)
	}

	var tokens []scopeSourcePair
	for _, tsp := range tsps {
		tok := app.esi.TokenSource(&oauth2.Token{
			RefreshToken: tsp.token,
		})
		tokens = append(tokens, scopeSourcePair{
			scope: tsp.scope,
			token: tok,
		})
	}

	return tokens
}

func (app *app) callback(logger *zap.Logger, w http.ResponseWriter, r *http.Request, s *sessions.Session, code string) {
	sessionStateValue := s.Values[sessionLoginState{}].(string)
	queryState := r.URL.Query().Get("state")
	delete(s.Values, sessionLoginState{})

	if sessionStateValue != queryState {
		// TODO: on a mismatch state there's a panic here?
		logger.Error("mismatch state",
			zap.String("sessionState", sessionStateValue),
			zap.String("queryState", queryState))
		delete(s.Values, sessionLoginState{})
		delete(s.Values, sessionLoginSrc{})
		http.Error(w, "mismatch state", http.StatusBadRequest)
		return
	}

	esiScopes := s.Values[sessionLoginScopes{}].([]glue.EsiScope)
	delete(s.Values, sessionLoginScopes{})

	token, err := app.esi.TokenExchange(code)
	if err != nil {
		http.Error(w, "token exchange error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
	defer cancel()

	claims, err := app.esi.VerifyTokenClaims(ctx, []byte(token.AccessToken))
	if err != nil {
		logger.Error("error verifying token claims", zap.Error(err))
		http.Error(w, "error verifying claims", http.StatusInternalServerError)
		return
	}

	logger = logger.With(
		zap.Int64("character_id", claims.CharacterId),
		zap.Strings("scopes", claims.Scopes),
		zap.String("character_name", claims.Name),
		zap.String("owner_hash", claims.OwnerHash))
	logger.Info("verified user")

	// esi get character corp and alliance
	tokSrc := app.esi.TokenSource(token)
	esiCtx := context.WithValue(context.Background(), esi.ContextOAuth2, tokSrc)
	affiliation, resp, err := app.esi.ESI.CharacterAPI.PostCharactersAffiliation(esiCtx).XCompatibilityDate(esiCompatDate).RequestBody([]int64{claims.CharacterId}).Execute()
	if err != nil || resp.StatusCode != http.StatusOK || len(affiliation) != 1 {
		logger.Error("error getting character affiliations", zap.Int("affiliation_length", len(affiliation)), zap.String("status", resp.Status), zap.Error(err))
		http.Error(w, "error getting character affiliations", http.StatusInternalServerError)
		return
	}

	charData := affiliation[0]
	if len(app.config.AllianceWhitelist) > 0 || len(app.config.CorporationWhitelist) > 0 {
		if !slices.Contains(app.config.AllianceWhitelist, charData.GetAllianceId()) {
			if !slices.Contains(app.config.CorporationWhitelist, charData.CorporationId) {
				logger.Warn("character not in corp or alliance whitelist")
				http.Error(w, "access denied", http.StatusForbidden)
				return
			}
		}
		// no alliance or corp whitelist has been set, let anyone login
	}

	var userId int64
	var toonId int64
	switch authType := authType(s.Values[sessionAuthType{}].(string)); authType {
	case authTypeLogin:
		userId = app.dao.getUserForCharacter(logger, claims.CharacterId, claims.OwnerHash)
		if userId == 0 {
			userId, toonId, err = app.dao.createUserWithCharacter(logger, claims.CharacterId, claims.OwnerHash)
			if err != nil {
				http.Error(w, "error creating user", http.StatusInternalServerError)
				return
			}
			logger.Debug("created user", zap.Int64("user_id", userId), zap.Int64("toon_id", toonId))
		}

	case authTypeAddCharacter, authTypeAddScopes:
		// we must already be logged in to add more characters
		user := app.getUserFromSession(r)
		if !user.IsLoggedIn() {
			logger.Warn("attempting to add character or scope without login", zap.String("auth_type", string(authType)))
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userId = user.UserId

		toonId, _, _ = app.dao.findOrCreateToon(logger, userId, claims.CharacterId, claims.OwnerHash)
		if toonId == 0 {
			logger.Debug("error creating toon", zap.Int64("user_id", userId), zap.Int64("toon_id", toonId))
			http.Error(w, "error creating toon", http.StatusInternalServerError)
			return
		}

		if err = app.dao.addScopes(logger, userId, toonId, esiScopes, token, s); err != nil {
			http.Error(w, "error adding scope", http.StatusInternalServerError)
			return
		}
	}

	delete(s.Values, sessionAuthType{})

	authData := user{
		UserId:        userId,
		Level:         authLevel_Authorized,
		CharacterId:   claims.CharacterId,
		CharacterName: claims.Name,
	}

	if charData.CorporationId == app.config.AdminCorp {
		authData.Level = authLevel_Admin
	}
	s.Values[sessionUserData{}] = authData

	sourcePage := s.Values[sessionLoginSrc{}].(string)
	delete(s.Values, sessionLoginSrc{})

	if err = s.Save(r, w); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// send unsigned cookie so the client has basic user data
	http.SetCookie(w, &http.Cookie{
		Name:     cookieUser,
		Value:    authData.toJson(),
		MaxAge:   60 * 60 * 24 * 30,
		HttpOnly: true,
	})

	// TODO: redirect using value stored in state
	http.Redirect(w, r, sourcePage, http.StatusFound)
}

func (app *app) createAuthHandlers(mux *http.ServeMux, mw *mwChain) {
	chain := mw.Add(app.authMiddlewareFactory(authLevel_Unauthorized))

	mux.Handle("GET /login", chain.HandleFunc(app.login))
	mux.Handle("GET /login/char", chain.HandleFunc(app.addCharToAccount))
	mux.Handle("GET /login/scope", chain.HandleFunc(app.addScopeToAccount))
	mux.Handle("GET /logout", chain.HandleFunc(app.logout))
	mux.Handle("GET /session", chain.HandleFunc(app.getSession))
}

// standard login
func (app *app) login(w http.ResponseWriter, r *http.Request) {
	logger := getLoggerFromContext(r.Context())
	logger.Debug("login")
	app.doLogin(w, r, authTypeLogin)
}

func (app *app) logout(w http.ResponseWriter, r *http.Request) {
	logger := getLoggerFromContext(r.Context())
	logger.Debug("logout")
	s, err := app.sessionStore.Get(r, cookieSession)
	if err != nil {
		http.Error(w, "failed to get session", http.StatusInternalServerError)
		return
	}

	s.Options.MaxAge = -1
	if err = s.Save(r, w); err != nil {
		http.Error(w, "failed to save session", http.StatusInternalServerError)
	}

	http.Redirect(w, r, "/", http.StatusFound)
}

func (app *app) getSession(w http.ResponseWriter, r *http.Request) {
	logger := getLoggerFromContext(r.Context())
	logger.Debug("get session")
	s, err := app.sessionStore.Get(r, cookieSession)
	if err != nil || s == nil {
		http.Error(w, "not logged in", http.StatusUnauthorized)
		return
	}

	authData := s.Values[sessionUserData{}]
	if authData == nil {
		http.Error(w, "no auth data found", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")

	httpWrite(w, authData)
}

func (app *app) addCharToAccount(w http.ResponseWriter, r *http.Request) {
	// check if already logged in
	logger := getLoggerFromContext(r.Context())
	logger.Debug("add char to account")
	s, _ := app.sessionStore.Get(r, cookieSession)
	if s.IsNew {
		http.Error(w, "not logged in", http.StatusUnauthorized)
		return
	}
	// add character to account
	app.doLogin(w, r, authTypeAddCharacter)
}

// director login
func (app *app) addScopeToAccount(w http.ResponseWriter, r *http.Request) {
	// check if already logged in
	logger := getLoggerFromContext(r.Context())
	logger.Debug("add scope to account")
	s, _ := app.sessionStore.Get(r, cookieSession)
	if s.IsNew {
		http.Error(w, "not logged in", http.StatusUnauthorized)
		return
	}

	// create rows with refresh token
	app.doLogin(w, r, authTypeAddScopes,
		glue.EsiScope_AssetsReadCorporationAssets_v1,
		glue.EsiScope_CorporationsReadBlueprints_v1,
		glue.EsiScope_CorporationsReadDivisions_v1,
		glue.EsiScope_IndustryReadCorporationJobs_v1,
		glue.EsiScope_UniverseReadStructures_v1,
	)
}
