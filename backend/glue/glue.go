package glue

import "github.com/AlHeamer/openesi/esi"

type InventoryItem struct {
	ItemId             int64  `json:"item_id,omitempty"`             /* Unique ID for this item. */
	TypeId             int64  `json:"type_id,omitempty"`             /* type_id integer */
	LocationId         int64  `json:"location_id,omitempty"`         /* References a station, a ship or an item_id if this blueprint is located within a container. */
	LocationFlag       string `json:"location_flag,omitempty"`       /* Type of the location_id */
	LocationType       string `json:"location_type,omitempty"`       /* location_type string */
	Quantity           int64  `json:"quantity,omitempty"`            /* A range of numbers with a minimum of -2 and no maximum value where -1 is an original and -2 is a copy. It can be a positive integer if it is a stack of blueprint originals fresh from the market (e.g. no activities performed on them yet). */
	Runs               int64  `json:"runs,omitempty"`                /* Number of runs remaining if the blueprint is a copy, -1 if it is an original. */
	MaterialEfficiency int64  `json:"material_efficiency,omitempty"` /* Material Efficiency Level of the blueprint. */
	TimeEfficiency     int64  `json:"time_efficiency,omitempty"`     /* Time Efficiency Level of the blueprint. */
	IsBlueprintCopy    bool   `json:"is_blueprint_copy,omitempty"`   /* is_blueprint_copy boolean */
	IsSingleton        bool   `json:"is_singleton,omitempty"`        /* is_singleton boolean */
}

func newInventoryItem(a *esi.CorporationsCorporationIdAssetsGetInner, b *esi.CorporationsCorporationIdBlueprintsGetInner) InventoryItem {
	var out InventoryItem
	if a != nil {
		out.ItemId = a.GetItemId()
		out.TypeId = a.GetTypeId()
		out.LocationId = a.GetLocationId()
		out.LocationFlag = a.GetLocationFlag()
		out.LocationType = a.GetLocationType()
		out.Quantity = a.GetQuantity()
		out.IsBlueprintCopy = a.GetIsBlueprintCopy()
		out.IsSingleton = a.GetIsSingleton()
	}

	if b != nil {
		out.ItemId = b.GetItemId()
		out.TypeId = b.GetTypeId()
		out.LocationId = b.GetLocationId()
		out.LocationFlag = b.GetLocationFlag()
		out.Quantity = b.GetQuantity()
		out.Runs = b.GetRuns()
		out.MaterialEfficiency = b.GetMaterialEfficiency()
		out.TimeEfficiency = b.GetTimeEfficiency()
		out.IsBlueprintCopy = b.GetQuantity() != -2
	}

	return out
}

type LocationType string

const (
	LocationType_Unknown     = "unknown"
	LocationType_Station     = "station"
	LocationType_SolarSystem = "solar_system"
	LocationType_Item        = "item"
	LocationType_Other       = "other"
)

/*
type LocationType int8
const (
	LocationType_Unknown     LocationType = 0
	LocationType_Station     LocationType = 1 // NPC Stations
	LocationType_SolarSystem LocationType = 2 // Items out in space
	LocationType_Item        LocationType = 3 // Items in items
	LocationType_Other       LocationType = 4 // ??
)

var LocationType_names = map[LocationType]string{
	LocationType_Unknown:     "unknown",
	LocationType_Station:     "station",
	LocationType_SolarSystem: "solar_system",
	LocationType_Item:        "item",
	LocationType_Other:       "other",
}
var LocationFlag_ids = map[string]LocationType{
	"unknown":      LocationType_Unknown,
	"station":      LocationType_Station,
	"solar_system": LocationType_Station,
	"item":         LocationType_Item,
	"other":        LocationType_Other,
}
*/

type LocationFlag string

const (
	LocationFlag_AssetSafety                         LocationFlag = "AssetSafety"
	LocationFlag_AutoFit                             LocationFlag = "AutoFit"
	LocationFlag_Bonus                               LocationFlag = "Bonus"
	LocationFlag_Booster                             LocationFlag = "Booster"
	LocationFlag_BoosterBay                          LocationFlag = "BoosterBay"
	LocationFlag_Capsule                             LocationFlag = "Capsule"
	LocationFlag_Cargo                               LocationFlag = "Cargo"
	LocationFlag_CorpDeliveries                      LocationFlag = "CorpDeliveries"
	LocationFlag_CorpSAG1                            LocationFlag = "CorpSAG1"
	LocationFlag_CorpSAG2                            LocationFlag = "CorpSAG2"
	LocationFlag_CorpSAG3                            LocationFlag = "CorpSAG3"
	LocationFlag_CorpSAG4                            LocationFlag = "CorpSAG4"
	LocationFlag_CorpSAG5                            LocationFlag = "CorpSAG5"
	LocationFlag_CorpSAG6                            LocationFlag = "CorpSAG6"
	LocationFlag_CorpSAG7                            LocationFlag = "CorpSAG7"
	LocationFlag_CrateLoot                           LocationFlag = "CrateLoot"
	LocationFlag_Deliveries                          LocationFlag = "Deliveries"
	LocationFlag_DroneBay                            LocationFlag = "DroneBay"
	LocationFlag_DustBattle                          LocationFlag = "DustBattle"
	LocationFlag_DustDatabank                        LocationFlag = "DustDatabank"
	LocationFlag_FighterBay                          LocationFlag = "FighterBay"
	LocationFlag_FighterTube0                        LocationFlag = "FighterTube0"
	LocationFlag_FighterTube1                        LocationFlag = "FighterTube1"
	LocationFlag_FighterTube2                        LocationFlag = "FighterTube2"
	LocationFlag_FighterTube3                        LocationFlag = "FighterTube3"
	LocationFlag_FighterTube4                        LocationFlag = "FighterTube4"
	LocationFlag_FleetHangar                         LocationFlag = "FleetHangar"
	LocationFlag_FrigateEscapeBay                    LocationFlag = "FrigateEscapeBay"
	LocationFlag_Hangar                              LocationFlag = "Hangar"
	LocationFlag_HangarAll                           LocationFlag = "HangarAll"
	LocationFlag_HiSlot0                             LocationFlag = "HiSlot0"
	LocationFlag_HiSlot1                             LocationFlag = "HiSlot1"
	LocationFlag_HiSlot2                             LocationFlag = "HiSlot2"
	LocationFlag_HiSlot3                             LocationFlag = "HiSlot3"
	LocationFlag_HiSlot4                             LocationFlag = "HiSlot4"
	LocationFlag_HiSlot5                             LocationFlag = "HiSlot5"
	LocationFlag_HiSlot6                             LocationFlag = "HiSlot6"
	LocationFlag_HiSlot7                             LocationFlag = "HiSlot7"
	LocationFlag_HiddenModifiers                     LocationFlag = "HiddenModifiers"
	LocationFlag_Implant                             LocationFlag = "Implant"
	LocationFlag_Impounded                           LocationFlag = "Impounded"
	LocationFlag_JunkyardReprocessed                 LocationFlag = "JunkyardReprocessed"
	LocationFlag_JunkyardTrashed                     LocationFlag = "JunkyardTrashed"
	LocationFlag_LoSlot0                             LocationFlag = "LoSlot0"
	LocationFlag_LoSlot1                             LocationFlag = "LoSlot1"
	LocationFlag_LoSlot2                             LocationFlag = "LoSlot2"
	LocationFlag_LoSlot3                             LocationFlag = "LoSlot3"
	LocationFlag_LoSlot4                             LocationFlag = "LoSlot4"
	LocationFlag_LoSlot5                             LocationFlag = "LoSlot5"
	LocationFlag_LoSlot6                             LocationFlag = "LoSlot6"
	LocationFlag_LoSlot7                             LocationFlag = "LoSlot7"
	LocationFlag_Locked                              LocationFlag = "Locked"
	LocationFlag_MedSlot0                            LocationFlag = "MedSlot0"
	LocationFlag_MedSlot1                            LocationFlag = "MedSlot1"
	LocationFlag_MedSlot2                            LocationFlag = "MedSlot2"
	LocationFlag_MedSlot3                            LocationFlag = "MedSlot3"
	LocationFlag_MedSlot4                            LocationFlag = "MedSlot4"
	LocationFlag_MedSlot5                            LocationFlag = "MedSlot5"
	LocationFlag_MedSlot6                            LocationFlag = "MedSlot6"
	LocationFlag_MedSlot7                            LocationFlag = "MedSlot7"
	LocationFlag_OfficeFolder                        LocationFlag = "OfficeFolder"
	LocationFlag_Pilot                               LocationFlag = "Pilot"
	LocationFlag_PlanetSurface                       LocationFlag = "PlanetSurface"
	LocationFlag_QuafeBay                            LocationFlag = "QuafeBay"
	LocationFlag_QuantumCoreRoom                     LocationFlag = "QuantumCoreRoom"
	LocationFlag_Reward                              LocationFlag = "Reward"
	LocationFlag_RigSlot0                            LocationFlag = "RigSlot0"
	LocationFlag_RigSlot1                            LocationFlag = "RigSlot1"
	LocationFlag_RigSlot2                            LocationFlag = "RigSlot2"
	LocationFlag_RigSlot3                            LocationFlag = "RigSlot3"
	LocationFlag_RigSlot4                            LocationFlag = "RigSlot4"
	LocationFlag_RigSlot5                            LocationFlag = "RigSlot5"
	LocationFlag_RigSlot6                            LocationFlag = "RigSlot6"
	LocationFlag_RigSlot7                            LocationFlag = "RigSlot7"
	LocationFlag_SecondaryStorage                    LocationFlag = "SecondaryStorage"
	LocationFlag_ServiceSlot0                        LocationFlag = "ServiceSlot0"
	LocationFlag_ServiceSlot1                        LocationFlag = "ServiceSlot1"
	LocationFlag_ServiceSlot2                        LocationFlag = "ServiceSlot2"
	LocationFlag_ServiceSlot3                        LocationFlag = "ServiceSlot3"
	LocationFlag_ServiceSlot4                        LocationFlag = "ServiceSlot4"
	LocationFlag_ServiceSlot5                        LocationFlag = "ServiceSlot5"
	LocationFlag_ServiceSlot6                        LocationFlag = "ServiceSlot6"
	LocationFlag_ServiceSlot7                        LocationFlag = "ServiceSlot7"
	LocationFlag_ShipHangar                          LocationFlag = "ShipHangar"
	LocationFlag_ShipOffline                         LocationFlag = "ShipOffline"
	LocationFlag_Skill                               LocationFlag = "Skill"
	LocationFlag_SkillInTraining                     LocationFlag = "SkillInTraining"
	LocationFlag_SpecializedAmmoHold                 LocationFlag = "SpecializedAmmoHold"
	LocationFlag_SpecializedCommandCenterHold        LocationFlag = "SpecializedCommandCenterHold"
	LocationFlag_SpecializedFuelBay                  LocationFlag = "SpecializedFuelBay"
	LocationFlag_SpecializedGasHold                  LocationFlag = "SpecializedGasHold"
	LocationFlag_SpecializedIndustrialShipHold       LocationFlag = "SpecializedIndustrialShipHold"
	LocationFlag_SpecializedLargeShipHold            LocationFlag = "SpecializedLargeShipHold"
	LocationFlag_SpecializedMaterialBay              LocationFlag = "SpecializedMaterialBay"
	LocationFlag_SpecializedMediumShipHold           LocationFlag = "SpecializedMediumShipHold"
	LocationFlag_SpecializedMineralHold              LocationFlag = "SpecializedMineralHold"
	LocationFlag_SpecializedOreHold                  LocationFlag = "SpecializedOreHold"
	LocationFlag_SpecializedPlanetaryCommoditiesHold LocationFlag = "SpecializedPlanetaryCommoditiesHold"
	LocationFlag_SpecializedSalvageHold              LocationFlag = "SpecializedSalvageHold"
	LocationFlag_SpecializedShipHold                 LocationFlag = "SpecializedShipHold"
	LocationFlag_SpecializedSmallShipHold            LocationFlag = "SpecializedSmallShipHold"
	LocationFlag_StructureActive                     LocationFlag = "StructureActive"
	LocationFlag_StructureFuel                       LocationFlag = "StructureFuel"
	LocationFlag_StructureInactive                   LocationFlag = "StructureInactive"
	LocationFlag_StructureOffline                    LocationFlag = "StructureOffline"
	LocationFlag_SubSystemBay                        LocationFlag = "SubSystemBay"
	LocationFlag_SubSystemSlot0                      LocationFlag = "SubSystemSlot0"
	LocationFlag_SubSystemSlot1                      LocationFlag = "SubSystemSlot1"
	LocationFlag_SubSystemSlot2                      LocationFlag = "SubSystemSlot2"
	LocationFlag_SubSystemSlot3                      LocationFlag = "SubSystemSlot3"
	LocationFlag_SubSystemSlot4                      LocationFlag = "SubSystemSlot4"
	LocationFlag_SubSystemSlot5                      LocationFlag = "SubSystemSlot5"
	LocationFlag_SubSystemSlot6                      LocationFlag = "SubSystemSlot6"
	LocationFlag_SubSystemSlot7                      LocationFlag = "SubSystemSlot7"
	LocationFlag_Unlocked                            LocationFlag = "Unlocked"
	LocationFlag_Wallet                              LocationFlag = "Wallet"
	LocationFlag_Wardrobe                            LocationFlag = "Wardrobe"
)

type EsiScope string

const (
	EsiScope_AlliancesReadContacts_v1                 EsiScope = "esi-alliances.read_contacts.v1"
	EsiScope_AssetsReadAssets_v1                      EsiScope = "esi-assets.read_assets.v1"
	EsiScope_AssetsReadCorporationAssets_v1           EsiScope = "esi-assets.read_corporation_assets.v1"
	EsiScope_CalendarReadCalendarEvents_v1            EsiScope = "esi-calendar.read_calendar_events.v1"
	EsiScope_CalendarRespondCalendarEvents_v1         EsiScope = "esi-calendar.respond_calendar_events.v1"
	EsiScope_CharactersReadAgentsResearch_v1          EsiScope = "esi-characters.read_agents_research.v1"
	EsiScope_CharactersReadBlueprints_v1              EsiScope = "esi-characters.read_blueprints.v1"
	EsiScope_CharactersReadChatChannels_v1            EsiScope = "esi-characters.read_chat_channels.v1"
	EsiScope_CharactersReadContacts_v1                EsiScope = "esi-characters.read_contacts.v1"
	EsiScope_CharactersReadCorporationRoles_v1        EsiScope = "esi-characters.read_corporation_roles.v1"
	EsiScope_CharactersReadFatigue_v1                 EsiScope = "esi-characters.read_fatigue.v1"
	EsiScope_CharactersReadFwStats_v1                 EsiScope = "esi-characters.read_fw_stats.v1"
	EsiScope_CharactersReadLoyalty_v1                 EsiScope = "esi-characters.read_loyalty.v1"
	EsiScope_CharactersReadMedals_v1                  EsiScope = "esi-characters.read_medals.v1"
	EsiScope_CharactersReadNotifications_v1           EsiScope = "esi-characters.read_notifications.v1"
	EsiScope_CharactersReadStandings_v1               EsiScope = "esi-characters.read_standings.v1"
	EsiScope_CharactersReadTitles_v1                  EsiScope = "esi-characters.read_titles.v1"
	EsiScope_CharactersWriteContacts_v1               EsiScope = "esi-characters.write_contacts.v1"
	EsiScope_CharacterstatsRead_v1                    EsiScope = "esi-characterstats.read.v1"
	EsiScope_ClonesReadClones_v1                      EsiScope = "esi-clones.read_clones.v1"
	EsiScope_ClonesReadImplants_v1                    EsiScope = "esi-clones.read_implants.v1"
	EsiScope_ContractsReadCharacter_contracts_v1      EsiScope = "esi-contracts.read_character_contracts.v1"
	EsiScope_ContractsReadCorporationContracts_v1     EsiScope = "esi-contracts.read_corporation_contracts.v1"
	EsiScope_CorporationsReadBlueprints_v1            EsiScope = "esi-corporations.read_blueprints.v1"
	EsiScope_CorporationsReadContacts_v1              EsiScope = "esi-corporations.read_contacts.v1"
	EsiScope_CorporationsReadContainerLogs_v1         EsiScope = "esi-corporations.read_container_logs.v1"
	EsiScope_CorporationsReadCorporationMembership_v1 EsiScope = "esi-corporations.read_corporation_membership.v1"
	EsiScope_CorporationsReadDivisions_v1             EsiScope = "esi-corporations.read_divisions.v1"
	EsiScope_CorporationsReadFacilities_v1            EsiScope = "esi-corporations.read_facilities.v1"
	EsiScope_CorporationsReadFwStats_v1               EsiScope = "esi-corporations.read_fw_stats.v1"
	EsiScope_CorporationsReadMedals_v1                EsiScope = "esi-corporations.read_medals.v1"
	EsiScope_CorporationsReadStandings_v1             EsiScope = "esi-corporations.read_standings.v1"
	EsiScope_CorporationsReadStarbases_v1             EsiScope = "esi-corporations.read_starbases.v1"
	EsiScope_CorporationsReadStructures_v1            EsiScope = "esi-corporations.read_structures.v1"
	EsiScope_CorporationsReadTitles_v1                EsiScope = "esi-corporations.read_titles.v1"
	EsiScope_CorporationsTrackMembers_v1              EsiScope = "esi-corporations.track_members.v1"
	EsiScope_FittingsReadFittings_v1                  EsiScope = "esi-fittings.read_fittings.v1"
	EsiScope_FittingsWriteFittings_v1                 EsiScope = "esi-fittings.write_fittings.v1"
	EsiScope_FleetsReadFleet_v1                       EsiScope = "esi-fleets.read_fleet.v1"
	EsiScope_FleetsWriteFleet_v1                      EsiScope = "esi-fleets.write_fleet.v1"
	EsiScope_IndustryReadCharacterJobs_v1             EsiScope = "esi-industry.read_character_jobs.v1"
	EsiScope_IndustryReadCharacterMining_v1           EsiScope = "esi-industry.read_character_mining.v1"
	EsiScope_IndustryReadCorporationJobs_v1           EsiScope = "esi-industry.read_corporation_jobs.v1"
	EsiScope_IndustryReadCorporationMining_v1         EsiScope = "esi-industry.read_corporation_mining.v1"
	EsiScope_KillmailsReadCorporationKillmails_v1     EsiScope = "esi-killmails.read_corporation_killmails.v1"
	EsiScope_KillmailsReadKillmails_v1                EsiScope = "esi-killmails.read_killmails.v1"
	EsiScope_LocationReadLocation_v1                  EsiScope = "esi-location.read_location.v1"
	EsiScope_LocationReadOnline_v1                    EsiScope = "esi-location.read_online.v1"
	EsiScope_LocationReadShipType_v1                  EsiScope = "esi-location.read_ship_type.v1"
	EsiScope_MailOrganizeMail_v1                      EsiScope = "esi-mail.organize_mail.v1"
	EsiScope_MailReadMail_v1                          EsiScope = "esi-mail.read_mail.v1"
	EsiScope_MailSendMail_v1                          EsiScope = "esi-mail.send_mail.v1"
	EsiScope_MarketsReadCharacterOrders_v1            EsiScope = "esi-markets.read_character_orders.v1"
	EsiScope_MarketsReadCorporationOrders_v1          EsiScope = "esi-markets.read_corporation_orders.v1"
	EsiScope_MarketsStructureMarkets_v1               EsiScope = "esi-markets.structure_markets.v1"
	EsiScope_PlanetsManagePlanets_v1                  EsiScope = "esi-planets.manage_planets.v1"
	EsiScope_PlanetsReadCustomsOffices_v1             EsiScope = "esi-planets.read_customs_offices.v1"
	EsiScope_PublicData                               EsiScope = "publicData"
	EsiScope_SearchSearchStructures_v1                EsiScope = "esi-search.search_structures.v1"
	EsiScope_SkillsReadSkillqueue_v1                  EsiScope = "esi-skills.read_skillqueue.v1"
	EsiScope_SkillsReadSkills_v1                      EsiScope = "esi-skills.read_skills.v1"
	EsiScope_UiOpenWindow_v1                          EsiScope = "esi-ui.open_window.v1"
	EsiScope_UiWriteWaypoint_v1                       EsiScope = "esi-ui.write_waypoint.v1"
	EsiScope_UniverseReadStructures_v1                EsiScope = "esi-universe.read_structures.v1"
	EsiScope_WalletReadCharacterWallet_v1             EsiScope = "esi-wallet.read_character_wallet.v1"
	EsiScope_WalletReadCorporationWallet_v1           EsiScope = "esi-wallet.read_corporation_wallet.v1"
	EsiScope_WalletReadCorporationWallets_v1          EsiScope = "esi-wallet.read_corporation_wallets.v1"
)

type NameCategory string

const (
	NameCategory_All           NameCategory = ""
	NameCategory_Alliance      NameCategory = "alliance"
	NameCategory_Character     NameCategory = "character"
	NameCategory_Constellation NameCategory = "constellation"
	NameCategory_Corporation   NameCategory = "corporation"
	NameCategory_InventoryType NameCategory = "inventory_type"
	NameCategory_Region        NameCategory = "region"
	NameCategory_SolarSystem   NameCategory = "solar_system"
	NameCategory_Station       NameCategory = "station"
	NameCategory_Faction       NameCategory = "faction"
)

func ResolveLoctionType[T int32 | int64](locationId T) LocationType {
	if locationId >= 30_000_000 && locationId < 40_000_000 {
		return LocationType_SolarSystem
	}
	if locationId >= 60_000_000 && locationId < 64_000_000 {
		return LocationType_Station
	}
	if locationId >= 100_000_000 {
		return LocationType_Item
	}

	return LocationType_Other
}
