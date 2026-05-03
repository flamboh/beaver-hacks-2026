import { ipcMain } from "electron"
import { DevServerService } from "./devServerService"
import type { LaunchProjectDevServerInput, ProjectDevServerInput } from "./contracts"

export function registerDevServerIpc(devServer: DevServerService): void {
	ipcMain.handle("dev-server:launch-project", (_event, input: LaunchProjectDevServerInput) =>
		devServer.launchProject(input)
	)
	ipcMain.handle("dev-server:get-project-status", (_event, input: ProjectDevServerInput) =>
		devServer.status(input)
	)
	ipcMain.handle("dev-server:stop-project", (_event, input: ProjectDevServerInput) =>
		devServer.stopProject(input)
	)
}

export type {
	LaunchProjectDevServerInput,
	ProjectDevServerInput,
	ProjectDevServerLaunch,
	ProjectDevServerStatus
} from "./contracts"
