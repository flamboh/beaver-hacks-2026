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
import type {
	LaunchProjectDevServerInput,
	ProjectDevServerInput,
	ProjectDevServerLaunch,
	ProjectDevServerStatus
} from "../main/devServer/ipc"
import type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitCommitMessage,
	GitCommitResult,
	GitCreateBranchInput,
	GitPushInput,
	GitPushResult,
	GitStatusSnapshot,
	GitWorkingTreeDiffSnapshot
} from "../main/git/ipc"

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
	git: {
		getStatus: (cwd: string): Promise<GitStatusSnapshot> =>
			ipcRenderer.invoke("git:get-status", cwd),
		getWorkingTreeDiff: (cwd?: string): Promise<GitWorkingTreeDiffSnapshot> =>
			ipcRenderer.invoke("git:get-working-tree-diff", cwd),
		checkout: (input: GitCheckoutInput): Promise<GitStatusSnapshot> =>
			ipcRenderer.invoke("git:checkout", input),
		createBranch: (input: GitCreateBranchInput): Promise<GitStatusSnapshot> =>
			ipcRenderer.invoke("git:create-branch", input),
		generateCommitMessage: (cwd: string): Promise<GitCommitMessage> =>
			ipcRenderer.invoke("git:generate-commit-message", cwd),
		commitAll: (input: GitCommitAllInput): Promise<GitCommitResult> =>
			ipcRenderer.invoke("git:commit-all", input),
		push: (input: GitPushInput): Promise<GitPushResult> => ipcRenderer.invoke("git:push", input)
	},
	db: {
		getInfo: (): Promise<DatabaseInfo> => ipcRenderer.invoke("db:get-info")
	},
	devServer: {
		launchProject: (input: LaunchProjectDevServerInput): Promise<ProjectDevServerLaunch> =>
			ipcRenderer.invoke("dev-server:launch-project", input),
		getProjectStatus: (input: ProjectDevServerInput): Promise<ProjectDevServerStatus> =>
			ipcRenderer.invoke("dev-server:get-project-status", input),
		stopProject: (input: ProjectDevServerInput): Promise<ProjectDevServerStatus> =>
			ipcRenderer.invoke("dev-server:stop-project", input)
	},
	dialog: {
		selectDirectory: (): Promise<string | null> => ipcRenderer.invoke("dialog:select-directory")
	},
	projects: {
		list: (): Promise<ProjectRow[]> => ipcRenderer.invoke("project:list"),
		get: (input: ProjectIdInput): Promise<ProjectRow> => ipcRenderer.invoke("project:get", input),
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
