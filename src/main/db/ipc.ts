import { ipcMain } from "electron"
import { DatabaseService } from "./database"
import type { CreateProjectInput, ProjectIdInput, UpdateProjectInput } from "./contracts"

export function registerDatabaseIpc(database: DatabaseService): void {
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
}

export type {
	CreateProjectInput,
	DatabaseInfo,
	ProjectIdInput,
	ProjectRow,
	UpdateProjectInput
} from "./contracts"
