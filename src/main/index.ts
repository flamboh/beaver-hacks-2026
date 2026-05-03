import { app, shell, BrowserWindow, type WebContents } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import icon from "../../resources/icon.png?asset"
import { AgentEngine } from "./agent/agentEngine"
import { registerAgentIpc } from "./agent/ipc"
import { DatabaseService } from "./db/database"
import { registerDatabaseIpc } from "./db/ipc"
import { TaskService } from "./db/tasks"
import { DevServerService } from "./devServer/devServerService"
import { registerDevServerIpc } from "./devServer/ipc"
import { registerDialogIpc } from "./dialog/ipc"
import { GitService } from "./git/gitService"
import { registerGitIpc } from "./git/ipc"
import { registerScopeFileIpc } from "./scopeFiles/ipc"
import { registerTerminalIpc } from "./terminal/ipc"
import { TerminalService } from "./terminal/terminalService"
import { TerminalSessionService } from "./terminal/terminalSessionService"

const agentEngine = new AgentEngine({ cwd: process.cwd() })
const gitService = new GitService()
const devServer = new DevServerService()
const terminalService = new TerminalService()
const terminalSessionService = new TerminalSessionService()
let database: DatabaseService | null = null
const CHROMIUM_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"

function configureBrowserWebview(contents: WebContents): void {
	contents.setUserAgent(CHROMIUM_USER_AGENT)
	contents.session.setUserAgent(CHROMIUM_USER_AGENT)
	contents.setWindowOpenHandler(({ url }) => {
		void contents.loadURL(url, { userAgent: CHROMIUM_USER_AGENT })
		return { action: "deny" }
	})
}

function createWindow(): void {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 900,
		height: 670,
		show: false,
		autoHideMenuBar: true,
		...(process.platform === "linux" ? { icon } : {}),
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			webviewTag: true,
			sandbox: false
		}
	})

	mainWindow.on("ready-to-show", () => {
		mainWindow.show()
	})

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: "deny" }
	})
	mainWindow.webContents.on("will-attach-webview", (_event, _webPreferences, params) => {
		params.partition = "persist:control-panel-browser"
		params.allowpopups = "true"
		params.useragent = CHROMIUM_USER_AGENT
	})
	mainWindow.webContents.on("did-attach-webview", (_event, contents) => {
		configureBrowserWebview(contents)
	})

	// HMR for renderer base on electron-vite cli.
	// Load the remote URL for development or the local html file for production.
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
		mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
	}
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
	// Set app user model id for windows
	electronApp.setAppUserModelId("com.electron")

	// Default open or close DevTools by F12 in development
	// and ignore CommandOrControl + R in production.
	// see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	database = new DatabaseService(join(app.getPath("userData"), "beaver.sqlite"))
	await database.initialize()
	agentEngine.setPlanSink(new TaskService(database.db))

	registerAgentIpc(agentEngine)
	registerDatabaseIpc(database)
	registerDevServerIpc(devServer)
	registerDialogIpc()
	registerScopeFileIpc()
	registerGitIpc(gitService, agentEngine, database)
	registerTerminalIpc(terminalService, terminalSessionService)

	createWindow()

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})

app.on("before-quit", () => {
	devServer.stop()
	terminalSessionService.disposeAll()
	void database?.close()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
