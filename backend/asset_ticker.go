package main

import (
	"context"
	"errors"
	"io"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/AlHeamer/brave-bpc/glue"
	"github.com/AlHeamer/openesi/esi"
	"go.uber.org/zap"
)

const (
	scienceLounge int64 = 1047935338899
	bpHangar            = string(glue.LocationFlag_CorpSAG7)
)

var (
	errCtxInitial      = errors.New("initial oauth context")
	errCtxCreateFailed = errors.New("createOauthContext failed")
)

func (app *app) createOauthContext(logger *zap.Logger) context.Context {
	pair := app.getAdminToken(logger)
	if len(pair.scope) == 0 {
		logger.Error("no available tokens for admin character", zap.Int64("character_id", app.config.AdminCharacter))
		ctx, cancel := context.WithCancelCause(context.Background())
		cancel(errCtxCreateFailed)
		return ctx
	}

	return context.WithValue(context.Background(), esi.ContextOAuth2, pair.token)
}

func (app *app) ticker(ctx context.Context) {
	var (
		logger        = app.logger.Named("ticker")
		ticker        = time.NewTicker(time.Second)
		refreshTicker = time.NewTicker(time.Minute)
		esiCtx        context.Context
	)
	app.adminTokenRefreshChan <- struct{}{} // manually trigger a token refresh
	ticker.Stop()                           // stop the ticker until we get a valid esiCtx

	{
		var cancel context.CancelCauseFunc
		esiCtx, cancel = context.WithCancelCause(context.Background())
		cancel(errCtxInitial)
	}

	refreshToken := func(ctx context.Context) context.Context {
		logger.Debug("refreshing token", zap.NamedError("cause", context.Cause(ctx)))
		ctx = app.createOauthContext(logger)
		if ctx.Err() == nil {
			refreshTicker.Stop()
			ticker.Reset(time.Second)
		}

		return ctx
	}

	for {
		select {
		case <-ctx.Done():
			logger.Info("exiting ticker loop")
			return

		case <-refreshTicker.C:
			esiCtx = refreshToken(esiCtx)

		case <-app.adminTokenRefreshChan:
			esiCtx = refreshToken(esiCtx)

		case <-ticker.C:
			if esiCtx.Err() != nil {
				ticker.Stop()
				refreshTicker.Reset(time.Minute)
				app.adminTokenRefreshChan <- struct{}{}
				break
			}

			var jitter time.Duration
			switch app.runtimeConfig.environment {
			case "prod", "production":
				jitter = time.Duration(rand.Int64N(int64(2 * time.Second)))
			}
			ticker.Reset(time.Hour + jitter)

			invState, err := app.updateBlueprintInventory(esiCtx, logger, false)
			if err != nil {
				logger.Error(err.Error())
			} else {
				app.invStateLock.Lock()
				app.inventoryState = invState
				app.invStateLock.Unlock()
			}
		}
	}
}

type inventoryState struct {
	blueprints     []esi.CorporationsCorporationIdBlueprintsGetInner
	assets         []esi.CorporationsCorporationIdAssetsGetInner
	bpcs           map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner
	bpos           map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner
	containerNames map[int64]string
	hangarNames    []string
	typeNames      map[int64]string
	tree           map[int64]*CorpAsset
}

func (app *app) updateBlueprintInventory(ctx context.Context, logger *zap.Logger, incremental bool) (*inventoryState, error) {
	var (
		start              = time.Now()
		unknownLocationIds []int64
		unknownTypeIds     []int64
		err                error
		inv                = &inventoryState{
			bpos: make(map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner),
			bpcs: make(map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner),
		}
	)

	if inv.blueprints, err = app.fetchCorpBlueprints(ctx, logger); err != nil {
		return nil, err
	}

	app.invStateLock.RLock()
	defer app.invStateLock.RUnlock()

	// populate bpo/bpc with a total count of each type/quality
	for _, bp := range inv.blueprints {
		// vv temp filtering code vv
		if bp.LocationFlag != bpHangar {
			continue
		}
		if parent, ok := inv.tree[bp.LocationId]; ok {
			if parent.Asset.LocationId != scienceLounge {
				if gp, gpok := inv.tree[parent.Asset.LocationId]; !gpok {
					continue
				} else {
					if gp.Asset.LocationId != scienceLounge {
						continue
					}
				}
			}
		}
		// ^^ temp filtering code ^^

		var (
			m   map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner
			qty int64 = 1
		)

		if _, ok := app.inventoryState.typeNames[bp.TypeId]; !ok || !incremental {
			unknownTypeIds = append(unknownTypeIds, bp.TypeId)
		}

		if _, ok := app.inventoryState.tree[bp.LocationId]; !ok {
			switch glue.LocationFlag(bp.LocationFlag) {
			default:
				unknownLocationIds = append(unknownLocationIds, bp.LocationId)
			case // noop for these location flags as they will error when calling the universe/names endpoint
				glue.LocationFlag_AssetSafety,
				glue.LocationFlag_CorpDeliveries,
				glue.LocationFlag_OfficeFolder:
			}
		}

		switch bp.Quantity {
		case -2: // BPC
			m = inv.bpcs
		case -1: // researched BPO
			m = inv.bpos
		default: // BPO stack > 0
			m = inv.bpos
			qty = bp.Quantity
		}

		idx := -1
		if _, ok := m[bp.TypeId]; !ok {
			m[bp.TypeId] = []esi.CorporationsCorporationIdBlueprintsGetInner{}
		} else {
			idx = slices.IndexFunc(m[bp.TypeId], func(e esi.CorporationsCorporationIdBlueprintsGetInner) bool {
				return sameBlueprintQuality(e, bp)
			})
		}

		if idx == -1 { // equivalent blueprint not found
			b := bp
			b.Quantity = qty
			m[bp.TypeId] = append(m[bp.TypeId], b)
		} else {
			m[bp.TypeId][idx].Quantity += qty
		}
	}

	wg := sync.WaitGroup{}
	if len(unknownLocationIds) > 0 || !incremental {
		wg.Add(1)
		go func() {
			defer wg.Done()
			inv.hangarNames = app.fetchCorpHangarNames(ctx, logger)
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			inv.containerNames = app.fetchCorpItemNames(ctx, logger, unknownLocationIds)
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			inv.assets, _ = app.fetchCorpAssets(ctx, logger)
		}()
	}

	if len(unknownTypeIds) > 0 || !incremental {
		wg.Add(1)
		go func() {
			defer wg.Done()
			inv.typeNames = app.fetchTypeNames(ctx, logger, glue.NameCategory_InventoryType, unknownTypeIds)
		}()
	}

	wg.Wait()

	inv.tree = app.buildAssetTree(inv.assets)

	logger.Debug("updated blueprint inventory", zap.Duration("duration", time.Since(start)))
	fetchBlueprintDuration.Observe(time.Since(start).Seconds())
	return inv, nil
}

func (app *app) fetchCorpAssets(ctx context.Context, logger *zap.Logger) ([]esi.CorporationsCorporationIdAssetsGetInner, error) {
	var (
		start         = time.Now()
		pages   int64 = 1
		attempt int   = 1
		assets  []esi.CorporationsCorporationIdAssetsGetInner
	)

	for page := int32(1); page <= int32(pages); page++ {
		reqCtx, cancel := context.WithTimeout(ctx, esiRequestTimeout)
		defer cancel()

		ap, resp, err := app.esi.ESI.AssetsAPI.GetCorporationsCorporationIdAssets(reqCtx, int64(app.config.AdminCorp)).
			XCompatibilityDate(esiCompatDate).
			Page(page).Execute()
		if err != nil {
			body := parseEsiError(err)
			logger.Error("error fetching assets", zap.Int32("page", page), zap.String("body", body), zap.Error(err))
			if attempt > 5 {
				return nil, errors.New("retries exceeded")
			}
			page--
			attempt++
			time.Sleep(time.Duration(rand.IntN(1000)) * time.Millisecond)
			continue
		} else if resp.StatusCode != http.StatusOK {
			// some other error happened. print to logs
			var buf []byte
			resp.Body.Read(buf)
			logger.Warn("status not 200", zap.Int32("page", page), zap.String("status_code", resp.Status), zap.String("body", string(buf)))
			if attempt > 5 {
				return nil, errors.New("retries exceeded")
			}
			page--
			attempt++
			time.Sleep(time.Duration(rand.IntN(1000)) * time.Millisecond)
			resp.Body.Close()
			continue
		}

		assets = append(assets, ap...)
		pages, _ = strconv.ParseInt(resp.Header.Get(headerPages), 10, 64)
		attempt = 1
		resp.Body.Close()
	}

	logger.Info("fetched assets", zap.Int64("pages", pages), zap.Int("assets", len(assets)), zap.Duration("duration", time.Since(start)))
	return assets, nil
}

func (app *app) fetchCorpBlueprints(ctx context.Context, logger *zap.Logger) ([]esi.CorporationsCorporationIdBlueprintsGetInner, error) {
	var (
		start            = time.Now()
		pages      int64 = 1
		attempt          = 1
		blueprints []esi.CorporationsCorporationIdBlueprintsGetInner
	)

	for page := int32(1); page <= int32(pages); page++ {
		reqCtx, cancel := context.WithTimeout(ctx, esiRequestTimeout)
		defer cancel()

		bp, resp, err := app.esi.ESI.CorporationAPI.GetCorporationsCorporationIdBlueprints(reqCtx, int64(app.config.AdminCorp)).
			XCompatibilityDate(esiCompatDate).
			Page(page).
			Execute()
		if err != nil {
			body := parseEsiError(err)
			logger.Warn("error fetching blueprints", zap.Int("attempt", attempt), zap.Int32("page", page), zap.String("body", body), zap.Error(err))
			if attempt > 5 {
				return nil, errors.New("retries exceeded")
			}

			page--
			attempt++
			time.Sleep(time.Duration(rand.IntN(1000)) * time.Millisecond)
			continue
		} else if resp.StatusCode != http.StatusOK {
			// some other error happened. print to logs
			var buf []byte
			resp.Body.Read(buf)
			logger.Warn("status not 200", zap.Int32("page", page), zap.String("status_code", resp.Status), zap.String("body", string(buf)))
			if attempt > 5 {
				return nil, errors.New("retries exceeded")
			}

			page--
			attempt++
			time.Sleep(time.Duration(rand.IntN(1000)) * time.Millisecond)
			resp.Body.Close()
			continue
		}

		blueprints = append(blueprints, bp...)
		pages, _ = strconv.ParseInt(resp.Header.Get(headerPages), 10, 64)
		resp.Body.Close()
		attempt = 1
	}

	logger.Info("finished fetching blueprints", zap.Int64("pages", pages), zap.Duration("duration", time.Since(start)))
	return blueprints, nil
}

func (app *app) fetchTypeNames(ctx context.Context, logger *zap.Logger, category glue.NameCategory, typeIds []int64) map[int64]string {
	slices.Sort(typeIds)
	typeIds = slices.Compact(typeIds)

	names := make(map[int64]string, len(typeIds))
	if len(typeIds) == 0 {
		return names
	}

	chunks := slices.Chunk(typeIds, 1000)
	for chunk := range chunks {
		cctx, cancel := context.WithTimeout(ctx, esiRequestTimeout)
		defer cancel()

		namePage, resp, err := app.esi.ESI.UniverseAPI.PostUniverseNames(cctx).
			XCompatibilityDate(esiCompatDate).
			RequestBody(chunk).
			Execute()
		if err != nil {
			body := parseEsiError(err)
			logger.Error("error fetching type names", zap.String("body", body), zap.Error(err))
			continue
		} else if resp.StatusCode != http.StatusOK {
			body, err := io.ReadAll(resp.Body)
			logger.Error("error fetching type names", zap.String("status", resp.Status), zap.Error(err), zap.String("body", string(body)))
			resp.Body.Close()
			continue
		}

		for _, v := range namePage {
			if category == glue.NameCategory_All || v.Category == string(category) {
				names[v.Id] = v.Name
			}
		}

		resp.Body.Close()
	}

	return names
}

func (app *app) fetchStructures(ctx context.Context, logger *zap.Logger, structureIds []int64) map[int64]esi.UniverseStructuresStructureIdGet {
	slices.Sort(structureIds)
	structureIds = slices.Compact(structureIds)

	structures := make(map[int64]esi.UniverseStructuresStructureIdGet, len(structureIds))
	if len(structureIds) == 0 {
		return structures
	}

	attempt := 1
	for i, structureId := range structureIds {
		var (
			structureData *esi.UniverseStructuresStructureIdGet
			stationData   *esi.UniverseStationsStationIdGet
			resp          *http.Response
			err           error
		)
		cctx, cancel := context.WithTimeout(ctx, esiRequestTimeout)
		defer cancel()

		structureType := glue.ResolveLoctionType(structureId)
		switch structureType {
		case glue.LocationType_Station:
			stationData, resp, err = app.esi.ESI.UniverseAPI.GetUniverseStationsStationId(cctx, structureId).
				XCompatibilityDate(esiCompatDate).Execute()
		case glue.LocationType_Item:
			structureData, resp, err = app.esi.ESI.UniverseAPI.GetUniverseStructuresStructureId(cctx, structureId).
				XCompatibilityDate(esiCompatDate).Execute()
		case glue.LocationType_SolarSystem:
			// noop
		default:
			logger.Warn("trying to get station data from solar system or other location", zap.Int64("id", structureId), zap.String("type", string(structureType)))
			continue
		}

		if err != nil {
			body := parseEsiError(err)
			logger.Error("error fetching structure data", zap.Int64("structure_id", structureId), zap.String("body", body), zap.Error(err))
			if attempt > 5 {
				return nil
			}
			i--
			attempt++
			time.Sleep(time.Duration(rand.IntN(1000)) * time.Millisecond)
			continue
		} else if resp.StatusCode != http.StatusOK {
			body, err := io.ReadAll(resp.Body)
			logger.Error("error fetching structure data", zap.Int64("structre_id", structureId), zap.String("status", resp.Status), zap.Error(err), zap.String("body", string(body)))
			if attempt > 5 {
				return nil
			}
			i--
			attempt++
			time.Sleep(time.Duration(rand.IntN(1000)) * time.Millisecond)
			resp.Body.Close()
			continue
		}

		if structureType == glue.LocationType_Station {
			structureData = &esi.UniverseStructuresStructureIdGet{
				Name:          stationData.Name,
				OwnerId:       stationData.GetOwner(),
				Position:      esi.NewUniverseStructuresStructureIdGetPosition(stationData.Position.X, stationData.Position.Y, stationData.Position.Z),
				SolarSystemId: stationData.SystemId,
				TypeId:        &stationData.TypeId,
			}
		}

		structures[structureId] = *structureData
		attempt = 1
		resp.Body.Close()
	}

	return structures
}

func (app *app) fetchCorpItemNames(ctx context.Context, logger *zap.Logger, itemIds []int64) map[int64]string {
	slices.Sort(itemIds)
	itemIds = slices.Compact(itemIds)

	names := make(map[int64]string, len(itemIds))
	if len(itemIds) == 0 {
		return names
	}

	chunks := slices.Chunk(itemIds, 1000)
	for chunk := range chunks {
		cctx, cancel := context.WithTimeout(ctx, esiRequestTimeout)
		defer cancel()

		namePage, resp, err := app.esi.ESI.AssetsAPI.PostCorporationsCorporationIdAssetsNames(cctx, int64(app.config.AdminCorp)).
			RequestBody(chunk).
			XCompatibilityDate(esiCompatDate).
			Execute()
		if err != nil {
			body := parseEsiError(err)
			logger.Error("error fetching item names", zap.String("body", body), zap.Error(err))
			continue
		} else if resp.StatusCode != http.StatusOK {
			body, err := io.ReadAll(resp.Body)
			logger.Error("error fetching item names", zap.String("status", resp.Status), zap.Error(err), zap.String("body", string(body)))
			continue
		}
		defer resp.Body.Close()

		for _, v := range namePage {
			names[v.ItemId] = v.Name
		}
	}

	return names
}

func (app *app) fetchCorpHangarNames(ctx context.Context, logger *zap.Logger) []string {
	reqCtx, cancel := context.WithTimeout(ctx, esiRequestTimeout)
	defer cancel()

	out := []string{"Division 1", "Division 2", "Division 3", "Division 4", "Division 5", "Division 6", "Division 7"}

	divisions, resp, err := app.esi.ESI.CorporationAPI.GetCorporationsCorporationIdDivisions(reqCtx, int64(app.config.AdminCorp)).
		XCompatibilityDate(esiCompatDate).
		Execute()
	if err != nil {
		body := parseEsiError(err)
		logger.Error("error fetching corp divisions", zap.String("body", body), zap.Error(err))
		return out
	} else if resp.StatusCode != http.StatusOK {
		// some other error happened. print to logs
		defer resp.Body.Close()
		var buf []byte
		resp.Body.Read(buf)
		logger.Warn("status not 200", zap.String("status_code", resp.Status), zap.String("body", string(buf)))
		return out
	}
	defer resp.Body.Close()

	for _, v := range divisions.Hangar {
		out[int(v.GetDivision())-1] = v.GetName()
	}

	return out
}

func buildItemLocationMap(blueprints []esi.CorporationsCorporationIdBlueprintsGetInner) map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner {
	locations := make(map[int64][]esi.CorporationsCorporationIdBlueprintsGetInner)
	for _, bp := range blueprints {
		if _, ok := locations[bp.LocationId]; !ok {
			locations[bp.LocationId] = []esi.CorporationsCorporationIdBlueprintsGetInner{bp}
			continue
		}
		locations[bp.LocationId] = append(locations[bp.LocationId], bp)
	}
	return locations
}

type CorpAsset struct {
	Name     string
	Asset    *esi.CorporationsCorporationIdAssetsGetInner
	Children []*CorpAsset
}

func (app *app) buildAssetTree(assetList []esi.CorporationsCorporationIdAssetsGetInner) map[int64]*CorpAsset {
	m := map[int64]*CorpAsset{}

	for _, asset := range assetList {
		ca := m[asset.ItemId]
		if ca == nil {
			ca = &CorpAsset{Asset: &asset}
			m[asset.ItemId] = ca
		}
		if ca.Asset == nil {
			ca.Asset = &asset
		}

		parent := m[asset.LocationId]
		if parent == nil {
			parent = &CorpAsset{}
			m[asset.LocationId] = parent
		}
		parent.Children = append(parent.Children, ca)
	}

	return m
}
