import * as sqlite3 from "sqlite3"
import { randomUUID } from "node:crypto"
import type { AgentRow } from "./contracts"

// ── types ─────────────────────────────────────────────────────────
interface AgentTableRow {
	id: string
	name: string
	project_id: string
	model: string
	scope_path: string
	effort: string
}

export interface CreateAgentInput {
	name: string
	project_id: string
	model: string
	scope_path: string
	effort: string
}

export interface UpdateAgentInput {
	id: string
	name?: string
	model?: string
	scope_path?: string
	effort?: string
}

// ── mapper ────────────────────────────────────────────────────────
function toAgentRow(row: AgentTableRow): AgentRow {
	return {
		id: row.id,
		name: row.name,
		project_id: row.project_id,
		model: row.model,
		scope_path: row.scope_path,
		effort: row.effort
	}
}

// ── service ───────────────────────────────────────────────────────
export class AgentService {
	constructor(private readonly db: sqlite3.Database) {}

	async listAgents(projectId: string): Promise<AgentRow[]> {
		const rows = await this.all<AgentTableRow>(
			`SELECT id, name, project_id, model, scope_path, effort
			 FROM agents
			 WHERE project_id = ?
			 ORDER BY rowid ASC`,
			[projectId]
		)
		return rows.map(toAgentRow)
	}

	async createAgent(input: CreateAgentInput): Promise<AgentRow> {
		const agent: AgentRow = {
			id: `agent:${randomUUID()}`,
			name: input.name.trim(),
			project_id: input.project_id,
			model: input.model,
			scope_path: input.scope_path.trim(),
			effort: input.effort
		}
		await this.run(
			`INSERT INTO agents (id, name, project_id, model, scope_path, effort)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[agent.id, agent.name, agent.project_id, agent.model, agent.scope_path, agent.effort]
		)
		return agent
	}

	async deleteAgent(id: string): Promise<void> {
		await this.run(`DELETE FROM agents WHERE id = ?`, [id])
	}

	async updateAgent(input: UpdateAgentInput): Promise<AgentRow> {
		await this.run(
			`
				UPDATE agents
				SET name = COALESCE(?, name),
					model = COALESCE(?, model),
					scope_path = COALESCE(?, scope_path),
					effort = COALESCE(?, effort)
				WHERE id = ?
			`,
			[input.name, input.model, input.scope_path, input.effort, input.id]
		)
		const row = await this.get<AgentTableRow>(
			`SELECT id, name, project_id, model, scope_path, effort
			 FROM agents
			 WHERE id = ?`,
			[input.id]
		)
		if (!row) throw new Error("Agent not found.")
		return toAgentRow(row)
	}

	// ── helpers ───────────────────────────────────────────────────
	private async run(sql: string, params: unknown[]): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, (err) => (err ? reject(err) : resolve()))
		})
	}

	private async get<T>(sql: string, params: unknown[]): Promise<T | undefined> {
		return new Promise((resolve, reject) => {
			this.db.get<T>(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
		})
	}

	private async all<T>(sql: string, params: unknown[]): Promise<T[]> {
		return new Promise((resolve, reject) => {
			this.db.all<T>(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
		})
	}
}
