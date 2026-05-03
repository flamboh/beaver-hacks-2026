import { ipcMain } from "electron"
import { DatabaseService } from "./database"
import { AgentService, CreateAgentInput, UpdateAgentInput } from "./agents"
import { TaskService, CreateTaskInput } from "./tasks"
import { CreateToolCardInput, ToolCardService } from "./toolCards"

import type {
	CreateProjectInput,
	CreateWorkspaceInput,
	ProjectIdInput,
	ProjectWorkspaceInput,
	UpdateProjectInput,
	UpdateSettingInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput
} from "./contracts"

export function registerDatabaseIpc(database: DatabaseService): void {
	const agents = new AgentService(database.db)
	const tasks = new TaskService(database.db)
	const toolCards = new ToolCardService(database.db)

	// project handlers
	ipcMain.handle("db:get-info", () => database.getInfo())
	ipcMain.handle("project:list", () => database.listProjects())
	ipcMain.handle("project:get", (_event, input: ProjectIdInput) => database.getProject(input))
	ipcMain.handle("project:create", (_event, input: CreateProjectInput) =>
		database.createProject(input)
	)
	ipcMain.handle("project:update", (_event, input: UpdateProjectInput) =>
		database.updateProject(input)
	)
	ipcMain.handle("project:touch", (_event, input: ProjectIdInput) => database.touchProject(input))
	ipcMain.handle("project:delete", (_event, input: ProjectIdInput) => database.deleteProject(input))
	ipcMain.handle("workspace:list", (_event, input: ProjectWorkspaceInput) =>
		database.listWorkspaces(input)
	)
	ipcMain.handle("workspace:active", (_event, input: ProjectWorkspaceInput) =>
		database.getActiveWorkspace(input)
	)
	ipcMain.handle("workspace:create", (_event, input: CreateWorkspaceInput) =>
		database.createWorkspace(input)
	)
	ipcMain.handle("workspace:update", (_event, input: UpdateWorkspaceInput) =>
		database.updateWorkspace(input)
	)
	ipcMain.handle("workspace:activate", (_event, input: WorkspaceIdInput) =>
		database.activateWorkspace(input)
	)
	ipcMain.handle("workspace:touch-prompted", (_event, input: WorkspaceIdInput) =>
		database.touchWorkspacePrompted(input)
	)
	ipcMain.handle("workspace:delete", (_event, input: WorkspaceIdInput) =>
		database.deleteWorkspace(input)
	)
	ipcMain.handle("setting:get", (_event, key: string) => database.getSetting(key))
	ipcMain.handle("setting:update", (_event, input: UpdateSettingInput) =>
		database.updateSetting(input)
	)

	// agent handlers
	ipcMain.handle("agent:list", (_event, projectId: string) => agents.listAgents(projectId))
	ipcMain.handle("agent:create", (_event, input: CreateAgentInput) => agents.createAgent(input))
	ipcMain.handle("agent:update", (_event, input: UpdateAgentInput) => agents.updateAgent(input))
	ipcMain.handle("agent:delete", (_event, id: string) => agents.deleteAgent(id))

	// tool card handlers
	ipcMain.handle("tool-card:list", (_event, projectId: string) =>
		toolCards.listToolCards(projectId)
	)
	ipcMain.handle("tool-card:create", (_event, input: CreateToolCardInput) =>
		toolCards.createToolCard(input)
	)
	ipcMain.handle("tool-card:delete", (_event, id: string) => toolCards.deleteToolCard(id))

	// task handlers
	ipcMain.handle("task:list", (_event, agentId: string) => tasks.listTasks(agentId))
	ipcMain.handle("task:create", (_event, input: CreateTaskInput) => tasks.createTask(input))
}

export type {
	CreateProjectInput,
	CreateWorkspaceInput,
	DatabaseInfo,
	DeleteWorkspaceResult,
	ProjectIdInput,
	ProjectRow,
	ProjectWorkspaceInput,
	UpdateProjectInput,
	UpdateSettingInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput,
	WorkspaceRow
} from "./contracts"

export type { AgentRow, TaskRow } from "./contracts"
export type { CreateAgentInput, UpdateAgentInput } from "./agents"
export type { CreateToolCardInput } from "./toolCards"
export type { ToolCardRow } from "./contracts"
export type { CreateTaskInput } from "./tasks"
