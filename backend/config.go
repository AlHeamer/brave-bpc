package main

import (
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
)

const (
	defaultInitialAllianceID  int32 = 99003214
	defaultInitialAdminCorpID int32 = 98544197
	defaultInitialAdminCharID int32 = 95154016
	defaultMaxContracts      int32 = 2
	defaultMaxRequestItems   int32 = 10
	maxHomepageMarkdownBytes       = 32 * 1024
)

const defaultHomepageMarkdown = `# Welcome to Brave's BPC Request Program!

Thank you for your interest in Brave's BPC Program. This program is intended to help members of Brave Collective build what Brave needs.`

type publicConfig struct {
	HomepageMarkdown string `json:"homepage_markdown,omitempty"`
	MaxRequestItems  int32  `json:"max_request_items,omitempty"`
}

func parsePositiveInt32Env(key string, fallback int32) (int32, error) {
	rawValue, found := os.LookupEnv(key)
	if !found || len(strings.TrimSpace(rawValue)) == 0 {
		return fallback, nil
	}

	parsedValue, err := strconv.ParseInt(strings.TrimSpace(rawValue), 10, 32)
	if err != nil {
		return 0, fmt.Errorf("%s must be a positive integer: %w", key, err)
	}
	if parsedValue <= 0 {
		return 0, fmt.Errorf("%s must be greater than 0", key)
	}

	return int32(parsedValue), nil
}

func initialAppConfigFromEnv() (*appConfig, error) {
	allianceID, err := parsePositiveInt32Env(envInitialAllianceID, defaultInitialAllianceID)
	if err != nil {
		return nil, err
	}

	adminCorpID, err := parsePositiveInt32Env(envInitialAdminCorpID, defaultInitialAdminCorpID)
	if err != nil {
		return nil, err
	}

	adminCharacterID, err := parsePositiveInt32Env(envInitialAdminCharacterID, defaultInitialAdminCharID)
	if err != nil {
		return nil, err
	}

	return normalizeAppConfig(&appConfig{
		AllianceWhitelist: []int32{allianceID},
		AdminCorp:         adminCorpID,
		AdminCharacter:    adminCharacterID,
		MaxContracts:      defaultMaxContracts,
		MaxRequestItems:   defaultMaxRequestItems,
		HomepageMarkdown:  defaultHomepageMarkdown,
	}), nil
}

func normalizeInt32IDs(values []int32) []int32 {
	out := make([]int32, 0, len(values))
	for _, value := range values {
		if value > 0 {
			out = append(out, value)
		}
	}

	slices.Sort(out)
	return slices.Compact(out)
}

func normalizeMarkdown(markdown string) string {
	markdown = strings.ReplaceAll(markdown, "\r\n", "\n")
	return strings.TrimSpace(markdown)
}

func normalizeAppConfig(cfg *appConfig) *appConfig {
	if cfg == nil {
		cfg = &appConfig{}
	}

	normalized := *cfg
	normalized.AllianceWhitelist = normalizeInt32IDs(cfg.AllianceWhitelist)
	normalized.CorporationWhitelist = normalizeInt32IDs(cfg.CorporationWhitelist)
	normalized.HomepageMarkdown = normalizeMarkdown(cfg.HomepageMarkdown)
	if normalized.MaxContracts <= 0 {
		normalized.MaxContracts = defaultMaxContracts
	}
	if normalized.MaxRequestItems <= 0 {
		normalized.MaxRequestItems = defaultMaxRequestItems
	}

	return &normalized
}

func validatePositiveIDs(label string, values []int32) error {
	for _, value := range values {
		if value <= 0 {
			return fmt.Errorf("%s must only contain positive IDs", label)
		}
	}

	return nil
}

func validateAppConfig(cfg *appConfig) error {
	if cfg == nil {
		return fmt.Errorf("config is required")
	}
	if err := validatePositiveIDs("alliances", cfg.AllianceWhitelist); err != nil {
		return err
	}
	if err := validatePositiveIDs("corporations", cfg.CorporationWhitelist); err != nil {
		return err
	}
	if cfg.AdminCorp <= 0 {
		return fmt.Errorf("admin_corp must be greater than 0")
	}
	if cfg.AdminCharacter <= 0 {
		return fmt.Errorf("admin_char must be greater than 0")
	}
	if cfg.MaxContracts <= 0 {
		return fmt.Errorf("max_contracts must be greater than 0")
	}
	if cfg.MaxRequestItems <= 0 {
		return fmt.Errorf("max_request_items must be greater than 0")
	}
	if len(cfg.HomepageMarkdown) > maxHomepageMarkdownBytes {
		return fmt.Errorf("homepage_markdown must be %d bytes or less", maxHomepageMarkdownBytes)
	}

	return nil
}

func (cfg *appConfig) publicConfig() publicConfig {
	if cfg == nil {
		return publicConfig{MaxRequestItems: defaultMaxRequestItems}
	}

	return publicConfig{
		HomepageMarkdown: cfg.HomepageMarkdown,
		MaxRequestItems:  cfg.MaxRequestItems,
	}
}