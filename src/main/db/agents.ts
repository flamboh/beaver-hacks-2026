import * as sqlite3 from "sqlite3"
import { randomUUID } from "node:crypto"
import type { AgentProvider, AgentRow } from "./contracts"

// ── types ─────────────────────────────────────────────────────────
interface AgentTableRow {
	id: string
	name: string
	project_id: string
	workspace_id: string | null
	provider: AgentProvider
	model: string
	scope_path: string
	effort: string
	layout_x: number
	layout_y: number
}

export interface CreateAgentInput {
	name: string
	project_id: string
	workspace_id?: string | null
	provider?: AgentProvider
	model: string
	scope_path: string
	effort: string
	layout_x?: number
	layout_y?: number
}

export interface UpdateAgentInput {
	id: string
	name: string
	expectedName?: string
}

// ── mapper ────────────────────────────────────────────────────────
function toAgentRow(row: AgentTableRow): AgentRow {
	return {
		id: row.id,
		name: row.name,
		project_id: row.project_id,
		workspace_id: row.workspace_id,
		provider: row.provider,
		model: row.model,
		scope_path: row.scope_path,
		effort: row.effort,
		layout_x: row.layout_x,
		layout_y: row.layout_y
	}
}

// ── service ───────────────────────────────────────────────────────
export class AgentService {
	constructor(private readonly db: sqlite3.Database) {}

	async listAgents(projectId: string): Promise<AgentRow[]> {
		const rows = await this.all<AgentTableRow>(
			`SELECT id, name, project_id, workspace_id, provider, model, scope_path, effort, layout_x, layout_y
			 FROM agents
			 WHERE project_id = ?
			 ORDER BY layout_y ASC, layout_x ASC, rowid ASC`,
			[projectId]
		)
		return rows.map(toAgentRow)
	}

	async createAgent(input: CreateAgentInput): Promise<AgentRow> {
		const agent: AgentRow = {
			id: `agent:${randomUUID()}`,
			name: input.name.trim(),
			project_id: input.project_id,
			workspace_id: input.workspace_id ?? null,
			provider: input.provider ?? "codex",
			model: input.model,
			scope_path: input.scope_path.trim(),
			effort: input.effort,
			layout_x: input.layout_x ?? 0,
			layout_y: input.layout_y ?? 0
		}
		await this.run(
			`INSERT INTO agents (id, name, project_id, workspace_id, provider, model, scope_path, effort, layout_x, layout_y)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				agent.id,
				agent.name,
				agent.project_id,
				agent.workspace_id,
				agent.provider,
				agent.model,
				agent.scope_path,
				agent.effort,
				agent.layout_x,
				agent.layout_y
			]
		)
		return agent
	}

	async updateAgent(input: UpdateAgentInput): Promise<AgentRow> {
		const name = input.name.trim()
		if (input.expectedName === undefined) {
			await this.run(`UPDATE agents SET name = ? WHERE id = ?`, [name, input.id])
		} else {
			await this.run(`UPDATE agents SET name = ? WHERE id = ? AND name = ?`, [
				name,
				input.id,
				input.expectedName
			])
		}
		const row = await this.get<AgentTableRow>(
			`SELECT id, name, project_id, workspace_id, provider, model, scope_path, effort, layout_x, layout_y
			 FROM agents
			 WHERE id = ?`,
			[input.id]
		)
		return toAgentRow(row)
	}

	async deleteAgent(id: string): Promise<void> {
		await this.run(`DELETE FROM agents WHERE id = ?`, [id])
	}

	// ── helpers ───────────────────────────────────────────────────
	private async run(sql: string, params: unknown[]): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, (err) => (err ? reject(err) : resolve()))
		})
	}

	private async all<T>(sql: string, params: unknown[]): Promise<T[]> {
		return new Promise((resolve, reject) => {
			this.db.all<T>(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
		})
	}

	private async get<T>(sql: string, params: unknown[]): Promise<T> {
		return new Promise((resolve, reject) => {
			this.db.get<T>(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
		})
	}
}
