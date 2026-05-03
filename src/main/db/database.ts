import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import * as sqlite3 from "sqlite3"
import type {
	CreateWorkspaceInput,
	CreateProjectInput,
	DatabaseInfo,
	DeleteWorkspaceResult,
	ProjectIdInput,
	ProjectRow,
	ProjectWorkspaceInput,
	UpdateSettingInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput,
	WorkspaceRow,
	UpdateProjectInput
} from "./contracts"

import type { ProjectTableRow } from "./rowMappers"
import { toProjectRow } from "./rowMappers"
import { INITIALIZE_SCHEMA_SQL } from "./schema"
import { assertDirectory, assertWorkspaceTemplate, canonicalPath } from "./workspaceUtils"
import { WorkspaceService } from "./workspaces"

const SCHEMA_VERSION = 5

function nowIso(): string {
	return new Date().toISOString()
}

function isUniqueProjectPathError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return error.message.includes("SQLITE_CONSTRAINT") && error.message.includes("projects.path")
}

export class DatabaseService {
	readonly db: sqlite3.Database
	private readonly workspaces: WorkspaceService

	constructor(private readonly path: string) {
		mkdirSync(dirname(path), { recursive: true })
		this.db = new sqlite3.Database(path)
		this.db.configure("busyTimeout", 5000)
		this.workspaces = new WorkspaceService(this.db)
	}

	async initialize(): Promise<void> {
		await this.exec(INITIALIZE_SCHEMA_SQL)
		await this.backfillProjectWorkspaces()

		// Base tables — no FK constraints yet so migration can recreate agents safely
		await this.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA foreign_keys = OFF;

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

			CREATE TABLE IF NOT EXISTS agents (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL,
				name TEXT NOT NULL DEFAULT '',
				workspace_id TEXT,
				provider TEXT NOT NULL DEFAULT 'codex',
				model TEXT NOT NULL,
				scope_path TEXT,
				effort TEXT NOT NULL,
				thread_id TEXT,
				layout_x INTEGER NOT NULL DEFAULT 0,
				layout_y INTEGER NOT NULL DEFAULT 0
			);

			CREATE TABLE IF NOT EXISTS task (
				id TEXT PRIMARY KEY,
				batch_id TEXT NOT NULL,
				agent_id TEXT NOT NULL,
				turn_id TEXT,
				status TEXT NOT NULL,
				description TEXT
			);

			CREATE TABLE IF NOT EXISTS batch (
				id TEXT PRIMARY KEY,
				agent_id TEXT NOT NULL,
				summary TEXT NOT NULL
			);

			INSERT INTO app_meta (key, value)
			VALUES ('schema_version', '1')
			ON CONFLICT(key) DO NOTHING;
		`)

		const versionRow = await this.get<{ value: string } | undefined>(
			`SELECT value FROM app_meta WHERE key = 'schema_version'`,
			[]
		)
		const storedVersion = versionRow ? Number(versionRow.value) : 0

		if (storedVersion < 2) {
			// Recreate agents with FK + name column — must disable FK enforcement during DDL
			await this.exec(`
				BEGIN TRANSACTION;
				CREATE TABLE agents_new (
					id TEXT PRIMARY KEY,
					project_id TEXT NOT NULL,
					name TEXT NOT NULL DEFAULT '',
					workspace_id TEXT,
					provider TEXT NOT NULL DEFAULT 'codex',
					model TEXT NOT NULL,
					scope_path TEXT,
					effort TEXT NOT NULL,
					FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
					FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
				);
				INSERT INTO agents_new (id, project_id, name, workspace_id, provider, model, scope_path, effort)
					SELECT id, project_id, '', NULL, 'codex', model, scope_path, effort FROM agents;
				DROP TABLE agents;
				ALTER TABLE agents_new RENAME TO agents;
				COMMIT;
			`)
		}

		if (storedVersion >= 2 && storedVersion < 3) {
			await this.exec(`
				BEGIN TRANSACTION;
				CREATE TABLE agents_new (
					id TEXT PRIMARY KEY,
					project_id TEXT NOT NULL,
					name TEXT NOT NULL DEFAULT '',
					workspace_id TEXT,
					provider TEXT NOT NULL DEFAULT 'codex',
					model TEXT NOT NULL,
					scope_path TEXT,
					effort TEXT NOT NULL,
					FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
					FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
				);
				INSERT INTO agents_new (id, project_id, name, workspace_id, provider, model, scope_path, effort)
					SELECT id, project_id, name, NULL, 'codex', model, scope_path, effort FROM agents;
				DROP TABLE agents;
				ALTER TABLE agents_new RENAME TO agents;
				COMMIT;
			`)
		}

		if (storedVersion < 3) {
			await this.exec(`
				BEGIN TRANSACTION;
				CREATE TABLE task_new (
					id TEXT PRIMARY KEY,
					batch_id TEXT NOT NULL,
					agent_id TEXT NOT NULL,
					turn_id TEXT,
					status TEXT NOT NULL,
					description TEXT,
					FOREIGN KEY(batch_id) REFERENCES batch(id) ON DELETE CASCADE,
					FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
				);
				INSERT INTO task_new (id, batch_id, agent_id, turn_id, status, description)
					SELECT id, batch_id, agent_id, NULL, status, description FROM task;
				DROP TABLE task;
				ALTER TABLE task_new RENAME TO task;
				COMMIT;
			`)
		}

		if (storedVersion < 4) {
			await this.ensureAgentLayoutColumns()
		}

		await this.ensureAgentLayoutColumns()
		await this.ensureAgentThreadColumn()

		await this.run(
			`INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			[String(SCHEMA_VERSION)]
		)

		// Re-enable FK enforcement for the lifetime of this connection
		await this.exec(`PRAGMA foreign_keys = ON`)
	}

	async getInfo(): Promise<DatabaseInfo> {
		const row = await this.get<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?`, [
			"schema_version"
		])

		return {
			path: this.path,
			schemaVersion: Number(row.value)
		}
	}

	private async ensureAgentLayoutColumns(): Promise<void> {
		const columns = await this.all<{ name: string }>(`PRAGMA table_info(agents)`, [])
		const columnNames = new Set(columns.map((column) => column.name))
		if (!columnNames.has("layout_x")) {
			await this.run(`ALTER TABLE agents ADD COLUMN layout_x INTEGER NOT NULL DEFAULT 0`, [])
		}
		if (!columnNames.has("layout_y")) {
			await this.run(`ALTER TABLE agents ADD COLUMN layout_y INTEGER NOT NULL DEFAULT 0`, [])
		}
		await this.exec(`
			WITH ordered AS (
				SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY rowid) - 1 AS idx
				FROM agents
				WHERE layout_x = 0 AND layout_y = 0
			)
			UPDATE agents
			SET
				layout_x = (SELECT idx % 2 FROM ordered WHERE ordered.id = agents.id),
				layout_y = (SELECT idx / 2 FROM ordered WHERE ordered.id = agents.id)
			WHERE id IN (SELECT id FROM ordered);
		`)
	}

	private async ensureAgentThreadColumn(): Promise<void> {
		const columns = await this.all<{ name: string }>(`PRAGMA table_info(agents)`, [])
		const columnNames = new Set(columns.map((column) => column.name))
		if (!columnNames.has("thread_id")) {
			await this.run(`ALTER TABLE agents ADD COLUMN thread_id TEXT`, [])
		}
	}

	async listProjects(): Promise<ProjectRow[]> {
		const rows = await this.all<ProjectTableRow>(
			`
				SELECT id, name, path, created_at, accessed
				FROM projects
				ORDER BY accessed DESC
			`,
			[]
		)
		return rows.map(toProjectRow)
	}

	async createProject(input: CreateProjectInput): Promise<ProjectRow> {
		const timestamp = nowIso()
		const name = input.name.trim()
		if (!name) throw new Error("Project name is required.")
		const path = canonicalPath(input.path)
		assertDirectory(path)
		const project: ProjectRow = {
			id: `project:${randomUUID()}`,
			name,
			path,
			createdAt: timestamp,
			accessed: timestamp
		}

		try {
			await this.run(
				`
					INSERT INTO projects (id, name, path, created_at, accessed)
					VALUES (?, ?, ?, ?, ?)
				`,
				[project.id, project.name, project.path, project.createdAt, project.accessed]
			)
		} catch (error) {
			if (isUniqueProjectPathError(error)) {
				throw new Error("A project with this path already exists.")
			}
			throw error
		}

		await this.createWorkspace({
			projectId: project.id,
			name: "Source",
			path: project.path
		})

		return project
	}

	async updateProject(input: UpdateProjectInput): Promise<ProjectRow> {
		const name = input.name.trim()
		if (!name) throw new Error("Project name is required.")
		const path = canonicalPath(input.path)
		assertDirectory(path)
		await this.run(
			`
				UPDATE projects
				SET name = ?, path = ?
			WHERE id = ?
			`,
			[name, path, input.id]
		)

		return this.getProject(input)
	}

	async touchProject(input: ProjectIdInput): Promise<ProjectRow> {
		const timestamp = nowIso()
		await this.run(
			`
				UPDATE projects
				SET accessed = ?
				WHERE id = ?
			`,
			[timestamp, input.id]
		)

		return this.getProject(input)
	}

	async deleteProject(input: ProjectIdInput): Promise<void> {
		await this.run(`DELETE FROM projects WHERE id = ?`, [input.id])
	}

	async getProject(input: ProjectIdInput): Promise<ProjectRow> {
		const row = await this.get<ProjectTableRow>(
			`
				SELECT id, name, path, created_at, accessed
				FROM projects
				WHERE id = ?
			`,
			[input.id]
		)
		if (!row) throw new Error("Project not found.")
		return toProjectRow(row)
	}

	async listWorkspaces(input: ProjectWorkspaceInput): Promise<WorkspaceRow[]> {
		return this.workspaces.list(input)
	}

	async getWorkspace(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		return this.workspaces.get(input)
	}

	async getActiveWorkspace(input: ProjectWorkspaceInput): Promise<WorkspaceRow> {
		return this.workspaces.getActive(input)
	}

	async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRow> {
		return this.workspaces.create(input)
	}

	async updateWorkspace(input: UpdateWorkspaceInput): Promise<WorkspaceRow> {
		return this.workspaces.update(input)
	}

	async activateWorkspace(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		return this.workspaces.activate(input)
	}

	async deleteWorkspace(input: WorkspaceIdInput): Promise<DeleteWorkspaceResult> {
		return this.workspaces.delete(input)
	}

	async getSetting(key: string): Promise<string> {
		const row = await this.get<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?`, [key])
		return row?.value ?? ""
	}

	async updateSetting(input: UpdateSettingInput): Promise<string> {
		if (input.key === "workspace.default_template") assertWorkspaceTemplate(input.value)
		await this.run(
			`
				INSERT INTO app_meta (key, value)
				VALUES (?, ?)
				ON CONFLICT(key) DO UPDATE SET value = excluded.value
			`,
			[input.key, input.value.trim()]
		)
		return this.getSetting(input.key)
	}

	async close(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			this.db.close((error) => {
				if (error) {
					reject(error)
					return
				}
				resolve()
			})
		})
	}

	private async backfillProjectWorkspaces(): Promise<void> {
		const projects = await this.listProjects()
		await this.workspaces.backfill(projects)
	}

	private async exec(sql: string): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			this.db.exec(sql, (error) => {
				if (error) {
					reject(error)
					return
				}
				resolve()
			})
		})
	}

	private async run(sql: string, params: unknown[]): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			this.db.run(sql, params, (error) => {
				if (error) {
					reject(error)
					return
				}
				resolve()
			})
		})
	}

	private async get<T>(sql: string, params: unknown[]): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.db.get<T>(sql, params, (error, row) => {
				if (error) {
					reject(error)
					return
				}
				resolve(row)
			})
		})
	}

	private async all<T>(sql: string, params: unknown[]): Promise<T[]> {
		return new Promise<T[]>((resolve, reject) => {
			this.db.all<T>(sql, params, (error, rows) => {
				if (error) {
					reject(error)
					return
				}
				resolve(rows)
			})
		})
	}
}
