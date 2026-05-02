import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import type {
	AgentSnapshot,
	FindSkillsInput,
	InstallSkillInput,
	StartTurnInput
} from "../main/agent/ipc"
import type {
	CreateProjectInput,
	DatabaseInfo,
	ProjectIdInput,
	ProjectRow,
	UpdateProjectInput
} from "../main/db/ipc"

// Custom APIs for renderer
const api = {
	agent: {
		getSnapshot: (): Promise<AgentSnapshot> => ipcRenderer.invoke("agent:get-snapshot"),
		startTurn: (input: StartTurnInput): Promise<AgentSnapshot> =>
			ipcRenderer.invoke("agent:start-turn", input),
		findSkills: (input: FindSkillsInput): Promise<AgentSnapshot> =>
			ipcRenderer.invoke("agent:find-skills", input),
		installSkill: (input: InstallSkillInput): Promise<AgentSnapshot> =>
			ipcRenderer.invoke("agent:install-skill", input),
		onSnapshot: (listener: (snapshot: AgentSnapshot) => void): (() => void) => {
			const handler = (_event: Electron.IpcRendererEvent, snapshot: AgentSnapshot): void => {
				listener(snapshot)
			}
			ipcRenderer.on("agent:snapshot", handler)
			return () => ipcRenderer.off("agent:snapshot", handler)
		}
	},
	db: {
		getInfo: (): Promise<DatabaseInfo> => ipcRenderer.invoke("db:get-info")
	},
	dialog: {
		selectDirectory: (): Promise<string | null> => ipcRenderer.invoke("dialog:select-directory")
	},
	projects: {
		list: (): Promise<ProjectRow[]> => ipcRenderer.invoke("project:list"),
		create: (input: CreateProjectInput): Promise<ProjectRow> =>
			ipcRenderer.invoke("project:create", input),
		update: (input: UpdateProjectInput): Promise<ProjectRow> =>
			ipcRenderer.invoke("project:update", input),
		touch: (input: ProjectIdInput): Promise<ProjectRow> =>
			ipcRenderer.invoke("project:touch", input),
		delete: (input: ProjectIdInput): Promise<void> => ipcRenderer.invoke("project:delete", input)
	}
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("electron", electronAPI)
		contextBridge.exposeInMainWorld("api", api)
	} catch (error) {
		console.error(error)
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI
	// @ts-ignore (define in dts)
	window.api = api
}
