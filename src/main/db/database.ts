import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { basename, dirname, isAbsolute, resolve } from "node:path"
import * as sqlite3 from "sqlite3"
import type {
	CreateWorkspaceInput,
	CreateProjectInput,
	DatabaseInfo,
	ProjectIdInput,
	ProjectRow,
	ProjectWorkspaceInput,
	UpdateSettingInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput,
	WorkspaceRow,
	UpdateProjectInput
} from "./contracts"

import type { ProjectTableRow, WorkspaceTableRow } from "./rowMappers"
import { toProjectRow, toWorkspaceRow } from "./rowMappers"
import { INITIALIZE_SCHEMA_SQL } from "./schema"
import {
	assertDirectory,
	canonicalPath,
	DEFAULT_WORKSPACE_TEMPLATE,
	resolveGitRoot,
	runGit,
	slugify
} from "./workspaceUtils"

const SCHEMA_VERSION = 2

function nowIso(): string {
	return new Date().toISOString()
}

function isUniqueProjectPathError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return error.message.includes("SQLITE_CONSTRAINT") && error.message.includes("projects.path")
}

export class DatabaseService {
	readonly db: sqlite3.Database

	constructor(private readonly path: string) {
		mkdirSync(dirname(path), { recursive: true })
		this.db = new sqlite3.Database(path)
		this.db.configure("busyTimeout", 5000)
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
					model TEXT NOT NULL,
					scope_path TEXT,
					effort TEXT NOT NULL,
					FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
				);
				INSERT INTO agents_new (id, project_id, name, model, scope_path, effort)
					SELECT id, project_id, '', model, scope_path, effort FROM agents;
				DROP TABLE agents;
				ALTER TABLE agents_new RENAME TO agents;
				COMMIT;
			`)
		}

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
		const path = canonicalPath(input.path)
		assertDirectory(path)
		const project: ProjectRow = {
			id: `project:${randomUUID()}`,
			name: input.name.trim(),
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
		const path = canonicalPath(input.path)
		assertDirectory(path)
		await this.run(
			`
				UPDATE projects
				SET name = ?, path = ?
				WHERE id = ?
			`,
			[input.name.trim(), path, input.id]
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
		const rows = await this.all<WorkspaceTableRow>(
			`
				SELECT id, project_id, name, path, git_root, active, created_at, accessed
				FROM workspaces
				WHERE project_id = ?
				ORDER BY active DESC, accessed DESC
			`,
			[input.projectId]
		)
		return rows.map(toWorkspaceRow)
	}

	async getWorkspace(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		const row = await this.get<WorkspaceTableRow>(
			`
				SELECT id, project_id, name, path, git_root, active, created_at, accessed
				FROM workspaces
				WHERE id = ?
			`,
			[input.id]
		)
		if (!row) throw new Error("Workspace not found.")
		return toWorkspaceRow(row)
	}

	async getActiveWorkspace(input: ProjectWorkspaceInput): Promise<WorkspaceRow> {
		const rows = await this.listWorkspaces(input)
		const workspace = rows[0]
		if (!workspace) throw new Error("Workspace not found.")
		return workspace
	}

	async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRow> {
		const project = await this.getProject({ id: input.projectId })
		const timestamp = nowIso()
		const customPath = input.path?.trim()
		const path = customPath
			? canonicalPath(customPath)
			: await this.nextDefaultWorkspacePath(project, input.name)
		if (customPath) {
			mkdirSync(path, { recursive: true })
		} else {
			const projectGitRoot = await resolveGitRoot(project.path)
			if (projectGitRoot) {
				await runGit(projectGitRoot, ["worktree", "add", "-b", slugify(input.name), path, "HEAD"])
			} else {
				mkdirSync(path, { recursive: true })
			}
		}
		assertDirectory(path)
		const gitRoot = await resolveGitRoot(path)
		const existing = await this.listWorkspaces({ projectId: input.projectId })
		const workspace: WorkspaceRow = {
			id: `workspace:${randomUUID()}`,
			projectId: input.projectId,
			name: input.name.trim() || basename(path),
			path,
			gitRoot,
			active: existing.length === 0,
			createdAt: timestamp,
			accessed: timestamp
		}

		await this.run(
			`
				INSERT INTO workspaces (id, project_id, name, path, git_root, active, created_at, accessed)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
			[
				workspace.id,
				workspace.projectId,
				workspace.name,
				workspace.path,
				workspace.gitRoot,
				workspace.active ? 1 : 0,
				workspace.createdAt,
				workspace.accessed
			]
		)
		return workspace
	}

	async updateWorkspace(input: UpdateWorkspaceInput): Promise<WorkspaceRow> {
		const path = canonicalPath(input.path)
		assertDirectory(path)
		const gitRoot = await resolveGitRoot(path)
		await this.run(
			`
				UPDATE workspaces
				SET name = ?, path = ?, git_root = ?
				WHERE id = ?
			`,
			[input.name.trim(), path, gitRoot, input.id]
		)
		return this.getWorkspace(input)
	}

	async activateWorkspace(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		const workspace = await this.getWorkspace(input)
		const timestamp = nowIso()
		await this.run(`UPDATE workspaces SET active = 0 WHERE project_id = ?`, [workspace.projectId])
		await this.run(`UPDATE workspaces SET active = 1, accessed = ? WHERE id = ?`, [
			timestamp,
			input.id
		])
		return this.getWorkspace(input)
	}

	async getSetting(key: string): Promise<string> {
		const row = await this.get<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?`, [key])
		return row?.value ?? ""
	}

	async updateSetting(input: UpdateSettingInput): Promise<string> {
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
		for (const project of projects) {
			const existing = await this.listWorkspaces({ projectId: project.id })
			if (existing.length > 0) continue
			await this.createWorkspace({
				projectId: project.id,
				name: "Source",
				path: project.path
			})
		}
	}

	private async nextDefaultWorkspacePath(
		project: ProjectRow,
		workspaceName: string
	): Promise<string> {
		const template =
			(await this.getSetting("workspace.default_template")) || DEFAULT_WORKSPACE_TEMPLATE
		const workspaceSlug = slugify(workspaceName)
		const projectSlug = slugify(project.name || basename(project.path))
		const projectParent = dirname(project.path)
		const expanded = template
			.replaceAll("{projectSlug}", projectSlug)
			.replaceAll("{workspaceSlug}", workspaceSlug)
		const basePath = isAbsolute(expanded) ? expanded : resolve(projectParent, expanded)
		let candidate = basePath
		let suffix = 2
		while (existsSync(candidate)) {
			candidate = `${basePath}-${suffix}`
			suffix += 1
		}
		return candidate
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
