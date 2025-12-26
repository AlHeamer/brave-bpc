package main

import "time"

type requestedBlueprint struct {
	TypeId             int32  `json:"type_id,omitempty"`
	Name               string `json:"type_name,omitempty"`
	Runs               int16  `json:"runs,omitempty"`
	MaterialEfficiency int8   `json:"me,omitempty"`
	TimeEfficiency     int8   `json:"te,omitempty"`
	Quantity           int32  `json:"quantity,omitempty"`
	Any                bool   `json:"any,omitempty"`
}

type postRequisitionOrderRequest struct {
	Blueprints []requestedBlueprint `json:"blueprints,omitempty"`
}

type requisitionOrder struct {
	Id            int64                `json:"id,omitempty"`
	CharacterId   int64                `json:"character_id,omitempty"`
	Status        requisitionStatus    `json:"status,omitempty"`
	CreatedAt     time.Time            `json:"created_at,omitzero"`
	UpdatedAt     time.Time            `json:"updated_at,omitzero"`
	Blueprints    []requestedBlueprint `json:"blueprints,omitempty"`
	CharacterName string               `json:"character_name,omitempty"`
	UpdatedBy     string               `json:"updated_by,omitempty"`
	PublicNotes   string               `json:"public_notes,omitempty"`
	Lock          *requisitionLock     `json:"lock,omitzero"`
}

type requisitionStatus int8

const (
	requisitionStatus_Unknown requisitionStatus = iota
	requisitionStatus_Open
	requisitionStatus_Canceled
	requisitionStatus_Completed
	requisitionStatus_Rejected
)

var requisitionStauts_name = map[requisitionStatus]string{
	requisitionStatus_Unknown:   "unknown",
	requisitionStatus_Open:      "open",
	requisitionStatus_Canceled:  "closed",
	requisitionStatus_Completed: "completed",
	requisitionStatus_Rejected:  "rejected",
}

func (r requisitionStatus) String() string {
	return requisitionStauts_name[r]
}
