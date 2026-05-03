import * as sqlite3 from "sqlite3"
import { randomUUID } from "node:crypto"
import type { TaskRow } from "./contracts"

export interface CreateTaskInput {
	agent_id: string
	status: string
	batch_id?: string
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
		const task: TaskRow = {
			id: `task:${randomUUID()}`,
			batch_id: input.batch_id ?? `batch:${randomUUID()}`,
			agent_id: input.agent_id,
			status: input.status,
			description: input.description ?? ""
		}
		await this.run(
			`INSERT INTO task (id, batch_id, agent_id, status, description) VALUES (?, ?, ?, ?, ?)`,
			[task.id, task.batch_id, task.agent_id, task.status, task.description]
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
