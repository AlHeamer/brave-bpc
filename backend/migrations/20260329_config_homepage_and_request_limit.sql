-- +goose Up
UPDATE config
SET updated_at = NOW(),
	updated_by = 'migration-20260329',
	config = JSON_INSERT(
		config,
		'$.max_request_items', 10,
		'$.homepage_markdown', '# Welcome to Brave''s BPC Request Program!

Thank you for your interest in Brave''s BPC Program. This program is intended to help members of Brave Collective build what Brave needs.'
	);

-- +goose Down
UPDATE config
SET updated_at = NOW(),
	updated_by = 'migration-20260329-down',
	config = JSON_REMOVE(
		JSON_REMOVE(config, '$.max_request_items'),
		'$.homepage_markdown'
	);