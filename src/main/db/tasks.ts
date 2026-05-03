import * as sqlite3 from "sqlite3"
import { randomUUID } from "node:crypto"
import type { TaskRow } from "./contracts"

export interface CreateTaskInput {
	agent_id: string
	batch_id?: string
	turn_id?: string | null
	status: string
	description?: string
}

export class TaskService {
	constructor(private readonly db: sqlite3.Database) {}

	async listTasks(agentId: string): Promise<TaskRow[]> {
		return this.all<TaskRow>(
			`SELECT id, batch_id, agent_id, status, COALESCE(description, '') AS description
			 FROM task WHERE agent_id = ? ORDER BY rowid ASC`,
			[agentId]
		)
	}

	async createTask(input: CreateTaskInput): Promise<TaskRow> {
		const batchId = input.batch_id ?? `batch:${randomUUID()}`
		const task: TaskRow = {
			id: `task:${randomUUID()}`,
			batch_id: input.batch_id ?? `batch:${randomUUID()}`,
			agent_id: input.agent_id,
			turn_id: input.turn_id ?? null,
			status: input.status,
			description: input.description ?? ""
		}
		await this.run(`INSERT OR IGNORE INTO batch (id, agent_id, summary) VALUES (?, ?, ?)`, [
			batchId,
			task.agent_id,
			task.description || "Task batch"
		])
		await this.run(
			`INSERT INTO task (id, batch_id, agent_id, turn_id, status, description)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[task.id, task.batch_id, task.agent_id, task.turn_id, task.status, task.description]
		)
		return task
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
