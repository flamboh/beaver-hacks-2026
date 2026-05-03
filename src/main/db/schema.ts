import { DEFAULT_WORKSPACE_TEMPLATE } from "./workspaceUtils"

export const SCHEMA_VERSION = 1

export const INITIALIZE_SCHEMA_SQL = `
	PRAGMA journal_mode = WAL;
	PRAGMA foreign_keys = ON;

	CREATE TABLE IF NOT EXISTS app_meta (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		path TEXT NOT NULL UNIQUE,
		created_at TEXT NOT NULL,
		accessed TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS workspaces (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		name TEXT NOT NULL,
		path TEXT NOT NULL UNIQUE,
		git_root TEXT,
		active INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		accessed TEXT NOT NULL,
		FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS agents (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		model TEXT NOT NULL,
		scope_path TEXT,
		effort TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS task (
		id TEXT PRIMARY KEY,
		batch_id TEXT NOT NULL,
		agent_id TEXT NOT NULL,
		status TEXT NOT NULL,
		description TEXT
	);

	CREATE TABLE IF NOT EXISTS batch (
		id TEXT PRIMARY KEY,
		agent_id TEXT NOT NULL,
		summary TEXT NOT NULL
	);

	INSERT INTO app_meta (key, value)
	VALUES ('schema_version', '${SCHEMA_VERSION}')
	ON CONFLICT(key) DO UPDATE SET value = excluded.value;

	INSERT INTO app_meta (key, value)
	VALUES ('workspace.default_template', '${DEFAULT_WORKSPACE_TEMPLATE}')
	ON CONFLICT(key) DO NOTHING;
`
