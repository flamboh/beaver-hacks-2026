import { ipcMain } from "electron"
import { DatabaseService } from "./database"
import { AgentService, CreateAgentInput } from "./agents"
import { TaskService, CreateTaskInput } from "./tasks"
import type { CreateProjectInput, ProjectIdInput, UpdateProjectInput } from "./contracts"

export function registerDatabaseIpc(database: DatabaseService): void {
	const agents = new AgentService(database.db)
	const tasks = new TaskService(database.db)

	// project handlers
	ipcMain.handle("db:get-info", () => database.getInfo())
	ipcMain.handle("project:list", () => database.listProjects())
	ipcMain.handle("project:create", (_event, input: CreateProjectInput) =>
		database.createProject(input)
	)
	ipcMain.handle("project:update", (_event, input: UpdateProjectInput) =>
		database.updateProject(input)
	)
	ipcMain.handle("project:touch", (_event, input: ProjectIdInput) => database.touchProject(input))
	ipcMain.handle("project:delete", (_event, input: ProjectIdInput) => database.deleteProject(input))

	// agent handlers
	ipcMain.handle("agent:list", (_event, projectId: string) => agents.listAgents(projectId))
	ipcMain.handle("agent:create", (_event, input: CreateAgentInput) => agents.createAgent(input))
	ipcMain.handle("agent:delete", (_event, id: string) => agents.deleteAgent(id))

	// task handlers
	ipcMain.handle("task:list", (_event, agentId: string) => tasks.listTasks(agentId))
	ipcMain.handle("task:create", (_event, input: CreateTaskInput) => tasks.createTask(input))
}

export type {
	CreateProjectInput,
	DatabaseInfo,
	ProjectIdInput,
	ProjectRow,
	UpdateProjectInput
} from "./contracts"

export type { AgentRow, TaskRow } from "./contracts"
export type { CreateAgentInput } from "./agents"
export type { CreateTaskInput } from "./tasks"
