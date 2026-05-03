import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import * as sqlite3 from "sqlite3"
import type {
	CreateProjectInput,
	DatabaseInfo,
	ProjectIdInput,
	ProjectRow,
	UpdateProjectInput
} from "./contracts"

const SCHEMA_VERSION = 1

interface ProjectTableRow {
	id: string
	name: string
	path: string
	created_at: string
	accessed: string
}

function nowIso(): string {
	return new Date().toISOString()
}

function toProjectRow(row: ProjectTableRow): ProjectRow {
	return {
		id: row.id,
		name: row.name,
		path: row.path,
		createdAt: row.created_at,
		accessed: row.accessed
	}
}

function isUniqueProjectPathError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return error.message.includes("SQLITE_CONSTRAINT") && error.message.includes("projects.path")
}

export class DatabaseService {
	private readonly db: sqlite3.Database

	constructor(private readonly path: string) {
		mkdirSync(dirname(path), { recursive: true })
		this.db = new sqlite3.Database(path)
		this.db.configure("busyTimeout", 5000)
	}

	async initialize(): Promise<void> {
		await this.exec(`
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
		`)
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
		const project: ProjectRow = {
			id: `project:${randomUUID()}`,
			name: input.name.trim(),
			path: input.path.trim(),
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

		return project
	}

	async updateProject(input: UpdateProjectInput): Promise<ProjectRow> {
		await this.run(
			`
				UPDATE projects
				SET name = ?, path = ?
				WHERE id = ?
			`,
			[input.name.trim(), input.path.trim(), input.id]
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

	private async getProject(input: ProjectIdInput): Promise<ProjectRow> {
		const row = await this.get<ProjectTableRow>(
			`
				SELECT id, name, path, created_at, accessed
				FROM projects
				WHERE id = ?
			`,
			[input.id]
		)
		return toProjectRow(row)
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
