package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/AlHeamer/brave-bpc/sqlparams"
	"github.com/gorilla/sessions"
	"github.com/pressly/goose/v3"
	"go.uber.org/zap"
	"golang.org/x/oauth2"
)

type scopeRefreshPair struct {
	token string
	scope string
}

type dao struct {
	db *sql.DB
}

func newDao(logger *zap.Logger) *dao {
	var db *sql.DB
	var err error
	db, err = sql.Open("mysql", dbConnectString())
	if err != nil {
		logger.Fatal("error opening db connection", zap.Error(err))
	}

	if err = db.Ping(); err != nil {
		logger.Fatal("error establishing db connetion", zap.Error(err))
	}
	return &dao{
		db: db,
	}
}

func (d *dao) loadAppConfig() (*appConfig, error) {
	var strConfig []byte
	if err := d.db.QueryRow(`
SELECT config
FROM config
ORDER BY updated_at DESC
LIMIT 1
`).Scan(&strConfig); err != nil {
		return nil, err
	}

	conf := &appConfig{}
	json.Unmarshal(strConfig, conf)

	return conf, nil
}

func (dao *dao) updateConfig(newConfig *appConfig) error {
	jsonConfig, err := json.Marshal(newConfig)
	if err != nil {
		return fmt.Errorf("error marshaling config json: %w", err)
	}

	_, err = dao.db.Exec(`
UPDATE config
SET config=?
`, jsonConfig)
	if err != nil {
		return fmt.Errorf("error updating config: %w", err)
	}

	return nil
}

func (d *dao) getTokenForCharacter(logger *zap.Logger, characterId int32, roles []string) []scopeRefreshPair {
	logger = logger.With(zap.Int32("character_id", characterId), zap.Strings("requested_roles", roles))

	params := sqlparams.New()
	rows, err := d.db.Query(`
SELECT s.scope, t.refresh_token
FROM scope s
	LEFT JOIN token t
		ON t.toon_id = s.toon_id
	LEFT JOIN toon o
		ON o.id = s.toon_id
WHERE o.character_id = `+params.AddParam(characterId)+`
AND s.scope IN(`+params.AddParams(roles)+`)
`, params...)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		logger.Error("could not fetch refresh token", zap.Error(err))
		return nil
	}

	var tsps []scopeRefreshPair
	for rows.Next() {
		var tsp scopeRefreshPair
		err := rows.Scan(&tsp.scope, &tsp.token)
		if err != nil {
			logger.Error("error scanning row", zap.Error(err))
		}
		tsps = append(tsps, tsp)
	}

	if rows.Err() != nil {
		logger.Error("error parsing rows", zap.Error(err))
		return nil
	}

	var missing []string
	for _, scope := range roles {
		if !slices.ContainsFunc(tsps, func(e scopeRefreshPair) bool {
			return scope == e.scope
		}) {
			missing = append(missing, scope)
		}
	}

	if len(missing) > 0 {
		logger.Error("requested scope(s) not found for toon", zap.Strings("missing_roles", missing))
	}

	return tsps
}

// userid, found, created
func (d *dao) getUserForCharacter(logger *zap.Logger, characterId int32, ownerHash string) int64 {
	logger = logger.With(zap.Int32("character_id", characterId), zap.String("owner_hash", ownerHash))

	var userId int64
	err := d.db.QueryRow(`
SELECT user_id
FROM toon
WHERE
character_id = ? AND
owner_hash = ?
`, characterId, ownerHash).Scan(&userId)

	if err != nil && err != sql.ErrNoRows {
		logger.Error("error finding user", zap.Error(err))
	}

	return userId
}

func (d *dao) createUserWithCharacter(logger *zap.Logger, characterId int32, ownerHash string) (int64, int64, error) {
	row, err := d.db.Exec(`
INSERT INTO user
(primary_toon_hash, date_created, date_modified)
VALUES(?, NOW(), NOW())
`, ownerHash)

	if err != nil {
		logger.Error("error creating new user", zap.Error(err))
		return 0, 0, err
	}

	var userId int64
	if userId, err = row.LastInsertId(); err != nil {
		logger.Error("error getting id when creating new user", zap.Error(err))
		return 0, 0, err
	}

	toonId, _, _ := d.findOrCreateToon(logger, userId, characterId, ownerHash)

	return userId, toonId, nil
}

// returns toon, found, created
func (d *dao) findOrCreateToon(logger *zap.Logger, userId int64, characterId int32, ownerHash string) (int64, bool, bool) {
	if userId <= 0 {
		return 0, false, false
	}

	logger = logger.With(zap.Int64("user_id", userId), zap.Int32("character_id", characterId), zap.String("owner_hash", ownerHash))
	var toonId int64
	err := d.db.QueryRow(`
SELECT id
FROM toon
WHERE character_id=? AND
owner_hash=? AND
user_id=?
`, characterId, ownerHash, userId).Scan(&toonId)

	if err == nil {
		return toonId, true, false
	} else if err != sql.ErrNoRows {
		logger.Error("error getting toon", zap.Error(err))
		return 0, false, false
	}

	res, err := d.db.Exec(`
INSERT INTO toon
(user_id, character_id, owner_hash)
VALUES(?, ?, ?)
`, userId, characterId, ownerHash)
	if err != nil {
		logger.Error("error creating toon", zap.Error(err))
		return 0, false, false
	}

	if toonId, err = res.LastInsertId(); err != nil {
		logger.Error("couldn't get toon_id", zap.Error(err))
		return 0, false, false
	}

	return toonId, false, true
}

func (d *dao) addScopes(logger *zap.Logger, userId int64, toonId int64, scopes []string, token *oauth2.Token, session *sessions.Session) error {
	if len(scopes) == 0 {
		// no need to store a token if there's no scopes
		return nil
	}
	slices.Sort(scopes)

	// TODO: check if this toon already has the scope, and remove it or replace it.
	var (
		tx     *sql.Tx
		err    error
		res    sql.Result
		rows   *sql.Rows
		params = sqlparams.New()
	)
	query := `
SELECT scope
FROM scope
WHERE
user_id = ` + params.AddParam(userId) + ` AND
toon_id = ` + params.AddParam(toonId) + ` AND
scope IN(` + params.AddParams(scopes) + `)
`
	rows, err = d.db.Query(query, params...)

	if err != nil && err != sql.ErrNoRows {
		logger.Error("error fetching existing roles", zap.Error(err))
		return err
	}

	foundScopes := make([]string, 0, len(scopes))
	for rows.Next() {
		var scope string
		if err = rows.Scan(&scope); err != nil {
			logger.Error("error scanning row", zap.Error(err))
			continue
		}
		foundScopes = append(foundScopes, scope)
	}

	if err = rows.Err(); err != nil {
		logger.Error("error iterating rows", zap.Error(err))
	}

	slices.Sort(foundScopes)
	if len(foundScopes) == len(scopes) {
		// no need to save, all scopes already exist
		session.Values[sessionLoginScopes{}] = foundScopes
		return nil
	}

	tx, err = d.db.Begin()
	if err != nil {
		logger.Error("error starting transaction", zap.Error(err))
		return err
	}

	params = sqlparams.New()
	res, err = tx.Exec(`
INSERT INTO token (toon_id, refresh_token)
VALUES (`+params.AddParams(toonId, token.RefreshToken)+`)
`, params...)
	if err != nil {
		logger.Error("error inserting toon", zap.Error(err))
		return err
	}

	var tokenId int64
	if tokenId, err = res.LastInsertId(); err != nil {
		logger.Error("error getting toon id", zap.Error(err))
		return err
	}

	params = sqlparams.New()
	scopeValues := make([]string, len(scopes))
	for i, scope := range scopes {
		scopeValues[i] = fmt.Sprintf("(%s)", params.AddParams(userId, toonId, tokenId, scope))
	}

	_, err = tx.Exec(`
INSERT INTO scope (user_id, toon_id, token_id, scope)
VALUES`+strings.Join(scopeValues, ",")+`
ON DUPLICATE KEY UPDATE token_id=`+params.AddParam(tokenId), params...)
	if err != nil {
		logger.Error("error inserting scopes", zap.Error(err))
		return err
	}

	if err = tx.Commit(); err != nil {
		logger.Error("error committing transaction", zap.Error(err))
		return err
	}

	// TODO: revoke old refresh token

	sessionScopes, found := session.Values[sessionLoginScopes{}]
	if !found {
		sessionScopes = make([]string, len(scopes))
	}
	sessionScopes = append(sessionScopes.([]string), scopes...)
	session.Values[sessionLoginScopes{}] = sessionScopes

	return nil
}

func (d *dao) runMigrations(logger *zap.Logger, migrateDown bool) {
	var err error
	goose.SetBaseFS(embedMigrations)
	goose.SetLogger(zap.NewStdLog(logger.Named("goose")))

	if err = goose.SetDialect("mysql"); err != nil {
		logger.Fatal("unable to setup db for migrations", zap.Error(err))
	}

	if migrateDown {
		if err = goose.Down(d.db, "migrations"); err != nil {
			logger.Warn("unable to down migrations", zap.Error(err))
		}
	}

	if err = goose.Up(d.db, "migrations"); err != nil {
		logger.Fatal("unable to up migrations", zap.Error(err))
	}
}

func (dao *dao) createRequisition(characterId int32, characterName string, blueprints []byte) error {
	var err error
	params := sqlparams.New()
	_, err = dao.db.Exec(`
INSERT INTO requisition_order
(character_id, blueprints, updated_by)
VALUES (`+params.AddParams(characterId, blueprints, characterName)+`)
`, params...)
	return err
}

func (dao *dao) getRequisition(reqId int64) (*requisitionOrder, error) {
	var bpjs []byte
	req := &requisitionOrder{}
	err := dao.db.QueryRow(`
SELECT *
FROM requisition_order
WHERE id=?`, reqId).Scan(
		req.Id,
		req.CharacterId,
		&bpjs,
		req.Status,
		req.CreatedAt,
		req.UpdatedAt,
		req.UpdatedBy,
		req.PublicNotes)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(bpjs, &req.Blueprints); err != nil {
		return nil, fmt.Errorf("error unmarshalling json: %w", err)
	}

	return req, nil
}

func (dao *dao) requisitionExists(reqId int64) (bool, error) {
	var count int64
	err := dao.db.QueryRow(`
SELECT COUNT(1)
FROM requisition
WHERE id=?`, reqId).Scan(&count)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return count > 0, nil
}

func (dao *dao) cancelRequisition(reqId int64, updatedBy string) error {
	_, err := dao.db.Exec(`
UPDATE requisition_order
SET
	status=?
	updated_at=NOW()
	updated_by="?"
WHERE
	id=?
`, requisitionStatus_Canceled, reqId, updatedBy)

	return err
}

func (dao *dao) completeRequisition(reqId int64, updatedBy string, notes string) error {
	_, err := dao.db.Exec(`
UPDATE requisition_order
SET
	status=?
	public_notes="?"
	updated_at=NOW()
	updated_by="?"
WHERE
	id=?
`, requisitionStatus_Completed, notes, reqId, updatedBy)

	return err
}

func (dao *dao) rejectRequisition(reqId int64, updatedBy string, notes string) error {
	_, err := dao.db.Exec(`
UPDATE requisition_order
SET
	status=?
	public_notes="?"
	updated_at=NOW()
	updated_by="?"
WHERE
	id=?
`, requisitionStatus_Rejected, notes, updatedBy, reqId)

	return err
}
