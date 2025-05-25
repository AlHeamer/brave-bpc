package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/AlHeamer/brave-bpc/glue"
	"go.uber.org/zap"
)

type requestedBlueprint struct {
	TypeId             int32
	Name               string
	Runs               int16
	MaterialEfficiency int8
	TimeEfficiency     int8
	Any                bool
}

type postRequisitionOrderRequest struct {
	Blueprints []requestedBlueprint
}

func (app *app) createApiHandlers(mux *http.ServeMux, mw *mwChain) {
	authChain := mw.Add(apiMiddleware, app.authMiddlewareFactory(authLevel_Authorized))
	workerChain := mw.Add(apiMiddleware, app.authMiddlewareFactory(authLevel_Worker))

	mux.Handle("/api/", mw.Add(apiMiddleware).HandleFunc(apiInvalid))

	mux.Handle("GET /api/blueprints", authChain.HandleFunc(app.getBlueprints))
	mux.Handle("POST /api/requisition", authChain.HandleFunc(app.postRequisitionOrder))
	mux.Handle("GET /api/requisition", authChain.HandleFunc(app.listRequisitionOrders))
	mux.Handle("GET /api/requisition/{id}", authChain.HandleFunc(app.getRequisitionOrder))
	mux.Handle("PATCH /api/requisition/{id}/cancel", authChain.HandleFunc(app.patchRequisitionOrder))
	mux.Handle("GET /api/namemap", authChain.HandleFunc(app.getNameMap))

	mux.Handle("PATCH /api/requisition/{id}/{action}", workerChain.HandleFunc(app.patchRequisitionOrder))
	mux.Handle("GET /api/config", workerChain.HandleFunc(app.getConfig))
	mux.Handle("POST /api/config", workerChain.HandleFunc(app.postConfig))
}

func (app *app) getConfig(w http.ResponseWriter, r *http.Request) {
	httpWrite(w, app.config)
}

func (app *app) postConfig(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	user := app.getUserFromSession(r)
	logger := getLoggerFromContext(r.Context())

	bytes, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, "error reading request", http.StatusBadRequest)
		return
	}

	newConfig := &appConfig{}
	if err = json.Unmarshal(bytes, newConfig); err != nil {
		httpError(w, "malformed config", http.StatusBadRequest)
		return
	}

	// TODO: validate

	if err = app.dao.updateConfig(newConfig); err != nil {
		logger.Error("error writing config to db", zap.Error(err))
		httpError(w, "error writing config", http.StatusInternalServerError)
		return
	}

	logger.Warn("app config updated",
		zap.String("updated_by", user.CharacterName),
		zap.Any("old_config", app.config),
		zap.Any("new_config", newConfig))
	app.config = newConfig
}

func apiInvalid(w http.ResponseWriter, r *http.Request) {
	httpError(w, "invalid request", http.StatusBadRequest)
}

func (app *app) getBlueprints(w http.ResponseWriter, r *http.Request) {
	httpWrite(w, app.bpcs.Data())
}

func (app *app) getNameMap(w http.ResponseWriter, r *http.Request){
	//TODO caching
	//TODO limit ID count in ESI call
	keys := app.bpcs.Keys()
	if len(keys) > 0 {
		names, resp, err := app.esi.ESI.UniverseApi.PostUniverseNames(context.Background(), keys, nil)
		if err != nil {
			http.Error(w, "error fetching type names", http.StatusInternalServerError)
			return
		}
		if resp.StatusCode != http.StatusOK {
			http.Error(w, "error fetching type names status no ok", http.StatusInternalServerError)
			return
		}

		nameMap := func() map[int32]string {
			nm := make(map[int32]string, len(names))
			for _, v := range names {
				if v.Category == string(glue.NameCategory_InventoryType) {
					nm[v.Id] = v.Name
				}
			}
			return nm
		}()
		httpWrite(w, nameMap)
	}
}

func (app *app) patchRequisitionOrder(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	user := app.getUserFromSession(r)
	logger := getLoggerFromContext(r.Context())

	reqId, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		httpError(w, "invalid requisition", http.StatusBadRequest)
		return
	}

	action := r.PathValue("action")
	logger = logger.With(zap.Int64("id", reqId), zap.String("action", action))

	var notes string

	switch action {
	case "lock":
		if _, ok := app.requisitionLocks.Get(reqId); ok {
			logger.Debug("attempting to lock pre-locked requisition")
			httpError(w, "resource locked", http.StatusBadRequest)
			return
		}

		if found, _ := app.dao.requisitionExists(reqId); !found {
			logger.Debug("invalid requisition")
			httpError(w, "invalid requisistion", http.StatusBadRequest)
			return
		}

		app.requisitionLocks.Set(reqId, user.CharacterId)

	case "unlock":
		if _, ok := app.requisitionLocks.Get(reqId); !ok {
			logger.Debug("attempting to unlock requisition that is not locked")
			httpError(w, "resource not locked", http.StatusBadRequest)
			return
		}
		app.requisitionLocks.Delete(reqId)

	case "cancel":
		lockUser, ok := app.requisitionLocks.Get(reqId)
		if ok {
			logger.Debug("attempting to cancel requisition that is locked", zap.Int32("locked_by", lockUser), zap.Int32("user", user.CharacterId))
			httpError(w, "resource is locked", http.StatusConflict)
			return
		}
		req, err := app.dao.getRequisition(reqId)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				httpError(w, "invalid requisition", http.StatusBadRequest)
				return
			}
			httpError(w, "error getting requisition", http.StatusInternalServerError)
			return
		}
		if user.CharacterId != req.CharacterId {
			httpError(w, "user/owner mismatch", http.StatusUnauthorized)
			return
		}

		app.requisitionLocks.Set(reqId, user.CharacterId)
		app.dao.cancelRequisition(reqId, user.CharacterName)
		app.requisitionLocks.Delete(reqId)

	case "complete":
		lockUser, ok := app.requisitionLocks.Get(reqId)
		if !ok {
			logger.Debug("attempting to complete requisition that is not locked", zap.Int32("locked_by", lockUser), zap.Int32("user", user.CharacterId))
			httpError(w, "resource not locked", http.StatusConflict)
			return
		}
		if lockUser != user.CharacterId {
			logger.Debug("can't complete requisition, locked by other user", zap.Int32("locked_by", lockUser), zap.Int32("user", user.CharacterId))
			httpError(w, "can't complete requisition, locked by other user", http.StatusForbidden)
			return
		}

		if err := app.dao.completeRequisition(reqId, user.CharacterName, notes); err != nil {
			logger.Error("error completing requisition", zap.Error(err))
			httpError(w, "error completing requisition", http.StatusInternalServerError)
			return
		}

	case "reject":
		lockUser, ok := app.requisitionLocks.Get(reqId)
		if !ok {
			logger.Debug("attempting to complete requisition that is not locked")
			httpError(w, "resource not locked", http.StatusConflict)
			return
		}
		if lockUser != user.CharacterId {
			logger.Debug("can't reject requisition, locked by other user", zap.Int32("locked_by", lockUser), zap.Int32("user", user.CharacterId))
			httpError(w, "can't reject requisition, locked by other user", http.StatusForbidden)
			return
		}

		if err := app.dao.rejectRequisition(reqId, user.CharacterName, notes); err != nil {
			logger.Error("error rejecting requisition", zap.Error(err))
			httpError(w, "error rejecting requisition", http.StatusInternalServerError)
			return
		}
	}

	//httpError(w, "ok", http.StatusOK)
}

func (app *app) getRequisitionOrder(w http.ResponseWriter, r *http.Request) {
	reqId, err := strconv.ParseInt(r.PathValue("requsition_id"), 10, 64)
	if err != nil {
		httpError(w, "invalid requisition", http.StatusBadRequest)
		return
	}
	logger := getLoggerFromContext(r.Context()).Named("api").With(zap.Int64("id", reqId))

	var req *requisitionOrder
	if req, err = app.dao.getRequisition(reqId); err != nil {
		logger.Error("error getting requisition", zap.Error(err))
		return
	}

	httpWrite(w, req)
}

func (app *app) listRequisitionOrders(w http.ResponseWriter, r *http.Request) {
	s, _ := app.sessionStore.Get(r, cookieSession)
	if s.IsNew {
		httpError(w, "not logged in", http.StatusUnauthorized)
		return
	}

	reqId, err := strconv.ParseInt(r.PathValue("requsition_id"), 10, 64)
	if err != nil {
		httpError(w, "invalid requisition", http.StatusBadRequest)
		return
	}
	logger := getLoggerFromContext(r.Context()).Named("api").With(zap.Int64("id", reqId))
	// TODO: get req from db
	logger.Debug("get requisition order")
}

// Create a new requisition order
// expects a postRequisitionOrderRequest in the body
func (app *app) postRequisitionOrder(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	s, _ := app.sessionStore.Get(r, cookieSession)
	if s.IsNew {
		httpError(w, "not logged in", http.StatusUnauthorized)
		return
	}

	// TODO: check user is in a valid corp

	user := app.getUserFromSession(r)
	logger := getLoggerFromContext(r.Context()).Named("api")

	var buf []byte
	if _, err := r.Body.Read(buf); err != nil {
		logger.Error("error reading body", zap.Error(err))
		httpError(w, "error reading request", http.StatusInternalServerError)
		return
	}

	var bpReq postRequisitionOrderRequest
	if err := json.Unmarshal(buf, &bpReq); err != nil {
		logger.Error("error unmarshalling json")
		httpError(w, "error reading request", http.StatusInternalServerError)
		return
	}

	if len(bpReq.Blueprints) == 0 {
		httpError(w, "invalid request", http.StatusBadRequest)
		return
	}

	if err := app.dao.createRequisition(user.CharacterId, user.CharacterName, buf); err != nil {
		httpError(w, "error creating requisition", http.StatusInternalServerError)
		return
	}
}
