package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
)

func (app *app) createApiHandlers(mux *http.ServeMux, mw *mwChain) {
	authChain := mw.Add(apiMiddleware, app.authMiddlewareFactory(authLevel_Authorized))
	workerChain := mw.Add(apiMiddleware, app.authMiddlewareFactory(authLevel_Worker))
	adminChain := mw.Add(apiMiddleware, app.authMiddlewareFactory(authLevel_Admin))

	mux.Handle("/api/", mw.Add(apiMiddleware).HandleFunc(apiInvalid))

	mux.Handle("GET /api/blueprints", authChain.HandleFunc(app.getBlueprints))

	mux.Handle("POST /api/requisition", authChain.HandleFunc(app.postRequisitionOrder))
	mux.Handle("GET /api/requisition", authChain.HandleFunc(app.listRequisitionOrders))
	mux.Handle("GET /api/requisition/{id}", authChain.HandleFunc(app.getRequisitionOrder))
	mux.Handle("PATCH /api/requisition/{id}/cancel", authChain.HandleFunc(app.patchRequisitionOrder))
	mux.Handle("PATCH /api/requisition/{id}/{action}", workerChain.HandleFunc(app.patchRequisitionOrder))

	mux.Handle("GET /api/refresh/admin", adminChain.HandleFunc(app.refreshAdminToken))
	mux.Handle("GET /api/config", workerChain.HandleFunc(app.getConfig))
	mux.Handle("POST /api/config", workerChain.HandleFunc(app.postConfig))
}

type GetBlueprintsBlueprint struct {
	MaterialEfficiency int32 `json:"material_efficiency,omitempty"`
	Quantity           int32 `json:"quantity,omitempty"`
	Runs               int32 `json:"runs,omitempty"`
	TimeEfficiency     int32 `json:"time_efficiency,omitempty"`
	TypeId             int32 `json:"type_id,omitempty"`
}

type GetBlueprintsType struct {
	TypeName   string                   `json:"type_name,omitempty"`
	Blueprints []GetBlueprintsBlueprint `json:"blueprints,omitempty"`
}

// change the token which is being used to refresh assets and names. eg. if roles or admin character changes
func (app *app) refreshAdminToken(w http.ResponseWriter, r *http.Request) {
	getLoggerFromContext(r.Context()).Debug("refreshAdminToken")
	app.adminTokenRefreshChan <- struct{}{}
	httpWrite(w, struct{}{})
}

func (app *app) getConfig(w http.ResponseWriter, r *http.Request) {
	httpWrite(w, app.config)
}

func (app *app) postConfig(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	user := app.getUserFromSession(r)
	logger := getLoggerFromContext(r.Context()).Named("api")

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
	httpError(w, "Not Found", http.StatusNotFound)
}

func (app *app) getBlueprints(w http.ResponseWriter, r *http.Request) {
	app.invStateLock.RLock()
	defer app.invStateLock.RUnlock()

	resp := make([]GetBlueprintsType, len(app.inventoryState.bpcs))

	var i int
	for typeId, bpcs := range app.inventoryState.bpcs {
		resp[i].TypeName = app.inventoryState.typeNames[typeId]
		resp[i].Blueprints = make([]GetBlueprintsBlueprint, len(bpcs))

		for j, bpc := range bpcs {
			resp[i].Blueprints[j] = GetBlueprintsBlueprint{
				MaterialEfficiency: bpc.MaterialEfficiency,
				Quantity:           bpc.Quantity,
				Runs:               bpc.Runs,
				TimeEfficiency:     bpc.TimeEfficiency,
				TypeId:             bpc.TypeId,
			}
		}

		i++
	}

	httpWrite(w, resp)
}

func (app *app) setRequisitionLock(user *user, reqId int64) error {
	lock, ok := app.getRequisitionLock(reqId)
	if ok {
		return fmt.Errorf("locked by %s at %s", lock.CharacterName, lock.LockedAt.Format(time.DateTime))
	}

	app.requisitionLocks.Set(reqId, requisitionLock{
		CharacterId:   user.CharacterId,
		CharacterName: user.CharacterName,
		LockedAt:      time.Now(),
	})
	return nil
}

func (app *app) deleteRequisitionLock(user *user, reqId int64) error {
	lock, ok := app.getRequisitionLock(reqId)
	if !ok {
		return errors.New("requisition lock does not exist")
	}

	if lock.CharacterId == user.CharacterId {
		app.requisitionLocks.Delete(reqId)
	}

	return nil
}

func (app *app) getRequisitionLock(reqId int64) (*requisitionLock, bool) {
	req, ok := app.requisitionLocks.Get(reqId)
	lock := &req
	if !ok {
		return nil, false
	}

	if time.Now().After(lock.LockedAt.Add(time.Hour)) {
		app.requisitionLocks.Delete(reqId)
		return nil, false
	}

	return lock, true
}

func (app *app) patchRequisitionOrder(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	user := app.getUserFromSession(r)
	logger := getLoggerFromContext(r.Context()).Named("api")

	reqId, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		httpError(w, "invalid requisition", http.StatusBadRequest)
		return
	}

	action := r.PathValue("action")
	if strings.Contains(r.Pattern, "cancel") {
		action = "cancel"
	}

	logger = logger.With(zap.Int64("id", reqId), zap.String("action", action))
	logger.Debug("patchRequisitionOrder")

	var notes string

	switch action {
	case "lock":
		if _, ok := app.getRequisitionLock(reqId); ok {
			logger.Debug("attempting to lock pre-locked requisition")
			httpError(w, "resource locked", http.StatusBadRequest)
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

		if req.Status != requisitionStatus_Open {
			httpError(w, "requisition is not open status="+req.Status.String(), http.StatusConflict)
			return
		}

		app.setRequisitionLock(user, reqId)

	case "unlock":
		lock, ok := app.getRequisitionLock(reqId)
		if !ok {
			logger.Debug("attempting to unlock requisition that is not locked")
			httpError(w, "resource not locked", http.StatusBadRequest)
			return
		}
		if lock.CharacterId != user.CharacterId {
			logger.Debug("attempting to unlock requisition locked by another user", zap.Any("lock", lock))
			httpError(w, "can't unlock requisition, locked by "+lock.CharacterName, http.StatusForbidden)
			return
		}

		app.requisitionLocks.Delete(reqId)

	case "cancel":
		lock, ok := app.getRequisitionLock(reqId)
		if ok {
			logger.Debug("attempting to cancel requisition that is locked", zap.Any("lock", lock))
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

		if req.Status != requisitionStatus_Open {
			httpError(w, "requisition is not open status="+req.Status.String(), http.StatusConflict)
			return
		}

		app.setRequisitionLock(user, reqId)
		if err = app.dao.cancelRequisition(reqId, user.CharacterName); err != nil {
			logger.Error("error cancelling requisition", zap.Error(err))
			httpError(w, "error cancelling requisition", http.StatusInternalServerError)
		}
		app.deleteRequisitionLock(user, reqId)

	case "complete":
		lock, ok := app.getRequisitionLock(reqId)
		if !ok {
			logger.Debug("attempting to complete requisition that is not locked", zap.Any("lock", lock))
			httpError(w, "resource not locked", http.StatusConflict)
			return
		}
		if lock.CharacterId != user.CharacterId {
			logger.Debug("can't complete requisition, locked by another user", zap.Any("lock", lock))
			httpError(w, "can't complete requisition, locked by "+lock.CharacterName, http.StatusForbidden)
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

		if req.Status != requisitionStatus_Open {
			httpError(w, "requisition is not open status="+req.Status.String(), http.StatusConflict)
			return
		}

		if err := app.dao.completeRequisition(reqId, user.CharacterName, notes); err != nil {
			logger.Error("error completing requisition", zap.Error(err))
			httpError(w, "error completing requisition", http.StatusInternalServerError)
			return
		}
		app.deleteRequisitionLock(user, reqId)

	case "reject":
		lock, ok := app.getRequisitionLock(reqId)
		if !ok {
			logger.Debug("attempting to complete requisition that is not locked")
			httpError(w, "resource not locked", http.StatusConflict)
			return
		}
		if lock.CharacterId != user.CharacterId {
			logger.Debug("can't reject requisition, locked by another user", zap.Any("lock", lock))
			httpError(w, "can't reject requisition, locked by "+lock.CharacterName, http.StatusForbidden)
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

		if req.Status != requisitionStatus_Open {
			httpError(w, "requisition is not open status="+req.Status.String(), http.StatusConflict)
			return
		}

		if err := app.dao.rejectRequisition(reqId, user.CharacterName, notes); err != nil {
			logger.Error("error rejecting requisition", zap.Error(err))
			httpError(w, "error rejecting requisition", http.StatusInternalServerError)
			return
		}
		app.deleteRequisitionLock(user, reqId)
	}
}

func (app *app) getRequisitionOrder(w http.ResponseWriter, r *http.Request) {
	reqId, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		httpError(w, "invalid requisition", http.StatusBadRequest)
		return
	}
	logger := getLoggerFromContext(r.Context()).Named("api").With(zap.Int64("id", reqId))
	logger.Debug("get requisition order")

	var req *requisitionOrder
	if req, err = app.dao.getRequisition(reqId); err != nil {
		logger.Error("error getting requisition", zap.Error(err))
		httpError(w, "error getting requisition", http.StatusInternalServerError)
		return
	}

	lock, _ := app.getRequisitionLock(reqId)
	req.Lock = lock

	httpWrite(w, req)
}

func (app *app) listRequisitionOrders(w http.ResponseWriter, r *http.Request) {
	logger := getLoggerFromContext(r.Context()).Named("api")
	logger.Debug("list requisition orders")

	status := requisitionStatus_Open
	strStatus := r.URL.Query().Get("status")
	intStatus, err := strconv.ParseInt(strStatus, 10, 64)
	if err == nil {
		status = requisitionStatus(intStatus)
	}

	user := app.getUserFromSession(r)
	characterId := user.CharacterId

	if user.Level >= authLevel_Worker {
		parsedChar, _ := strconv.ParseInt(r.URL.Query().Get("character_id"), 10, 64)
		characterId = int32(parsedChar)
	}

	orders, err := app.dao.listRequisitionOrders(characterId, status)
	if err != nil {
		logger.Error("error fetching requisition orders", zap.Error(err))
		httpError(w, "error fetching requisition orders", http.StatusInternalServerError)
		return
	}

	for i := range orders {
		lock, _ := app.getRequisitionLock(orders[i].Id)
		orders[i].Lock = lock
	}

	httpWrite(w, orders)
}

// Create a new requisition order
// expects a postRequisitionOrderRequest in the body
func (app *app) postRequisitionOrder(w http.ResponseWriter, r *http.Request) {
	var (
		user   = app.getUserFromSession(r)
		logger = getLoggerFromContext(r.Context()).Named("api")
		buf    []byte
		err    error
	)
	defer r.Body.Close()

	if buf, err = io.ReadAll(r.Body); err != nil {
		logger.Error("error reading body", zap.Error(err))
		httpError(w, "error reading request", http.StatusInternalServerError)
		return
	}

	var bpReq postRequisitionOrderRequest
	if err := json.Unmarshal(buf, &bpReq); err != nil {
		logger.Error("error unmarshalling json", zap.Error(err))
		httpError(w, "error reading request", http.StatusInternalServerError)
		return
	}

	if len(bpReq.Blueprints) == 0 {
		httpError(w, "invalid request", http.StatusBadRequest)
		return
	}

	if err := app.dao.createRequisition(user.CharacterId, user.CharacterName, bpReq.Blueprints); err != nil {
		httpError(w, "error creating requisition", http.StatusInternalServerError)
		return
	}

	logger.Debug("created requisition order")
}
