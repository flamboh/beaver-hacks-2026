import { randomUUID } from "node:crypto"
import * as sqlite3 from "sqlite3"
import type { ToolCardKind, ToolCardRow } from "./contracts"

interface ToolCardTableRow {
	id: string
	project_id: string
	workspace_id: string
	kind: ToolCardKind
	layout_x: number
	layout_y: number
	created_at: string
}

export interface CreateToolCardInput {
	project_id: string
	workspace_id: string
	kind: ToolCardKind
	layout_x?: number
	layout_y?: number
}

function nowIso(): string {
	return new Date().toISOString()
}

function toToolCardRow(row: ToolCardTableRow): ToolCardRow {
	return {
		id: row.id,
		project_id: row.project_id,
		workspace_id: row.workspace_id,
		kind: row.kind,
		layout_x: row.layout_x,
		layout_y: row.layout_y,
		created_at: row.created_at
	}
}

export class ToolCardService {
	constructor(private readonly db: sqlite3.Database) {}

	async listToolCards(projectId: string): Promise<ToolCardRow[]> {
		const rows = await this.all<ToolCardTableRow>(
			`SELECT id, project_id, workspace_id, kind, layout_x, layout_y, created_at
			 FROM tool_cards
			 WHERE project_id = ?
			 ORDER BY layout_y ASC, layout_x ASC, rowid ASC`,
			[projectId]
		)
		return rows.map(toToolCardRow)
	}

	async createToolCard(input: CreateToolCardInput): Promise<ToolCardRow> {
		const card: ToolCardRow = {
			id: `tool:${input.kind}:${randomUUID()}`,
			project_id: input.project_id,
			workspace_id: input.workspace_id,
			kind: input.kind,
			layout_x: input.layout_x ?? 0,
			layout_y: input.layout_y ?? 0,
			created_at: nowIso()
		}
		await this.run(
			`INSERT INTO tool_cards (id, project_id, workspace_id, kind, layout_x, layout_y, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				card.id,
				card.project_id,
				card.workspace_id,
				card.kind,
				card.layout_x,
				card.layout_y,
				card.created_at
			]
		)
		return card
	}

	async deleteToolCard(id: string): Promise<void> {
		await this.run(`DELETE FROM tool_cards WHERE id = ?`, [id])
	}

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
}
