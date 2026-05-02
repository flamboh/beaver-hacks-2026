import { ipcMain } from "electron"
import { DevServerService } from "./devServerService"

export function registerDevServerIpc(devServer: DevServerService): void {
	ipcMain.handle("dev-server:launch-review", () => devServer.launchReview())
}

export type { ReviewDevServerLaunch } from "./contracts"
