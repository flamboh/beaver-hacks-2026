import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import type {
	AgentSnapshot,
	FindSkillsInput,
	InstallSkillInput,
	SpawnThreadInput,
	StartTurnInput
} from "../main/agent/ipc"
import type {
	AgentRow,
	CreateAgentInput,
	CreateProjectInput,
	CreateWorkspaceInput,
	ProjectWorkspaceInput,
	UpdateSettingInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput,
	WorkspaceRow,
	CreateTaskInput,
	DatabaseInfo,
	ProjectIdInput,
	ProjectRow,
	TaskRow,
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
	GitDiffTour,
	GitPushInput,
	GitPushResult,
	GitStatusSnapshot,
	GitWorkingTreeDiffSnapshot
} from "../main/git/ipc"
import type { SaveScopeFileInput, SaveScopeFileResult } from "../main/scopeFiles/ipc"

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
		spawnThread: (input: SpawnThreadInput): Promise<AgentSnapshot> =>
			ipcRenderer.invoke("agent:spawn-thread", input),
		onSnapshot: (listener: (snapshot: AgentSnapshot) => void): (() => void) => {
			const handler = (_event: Electron.IpcRendererEvent, snapshot: AgentSnapshot): void => {
				listener(snapshot)
			}
			ipcRenderer.on("agent:snapshot", handler)
			return () => ipcRenderer.off("agent:snapshot", handler)
		}
	},
	git: {
		getStatus: (workspaceId: string): Promise<GitStatusSnapshot> =>
			ipcRenderer.invoke("git:get-status", workspaceId),
		getWorkingTreeDiff: (workspaceId: string): Promise<GitWorkingTreeDiffSnapshot> =>
			ipcRenderer.invoke("git:get-working-tree-diff", workspaceId),
		checkout: (input: GitCheckoutInput): Promise<GitStatusSnapshot> =>
			ipcRenderer.invoke("git:checkout", input),
		createBranch: (input: GitCreateBranchInput): Promise<GitStatusSnapshot> =>
			ipcRenderer.invoke("git:create-branch", input),
		generateCommitMessage: (workspaceId: string): Promise<GitCommitMessage> =>
			ipcRenderer.invoke("git:generate-commit-message", workspaceId),
		generateDiffTour: (workspaceId: string): Promise<GitDiffTour> =>
			ipcRenderer.invoke("git:generate-diff-tour", workspaceId),
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
		selectDirectory: (): Promise<string | null> => ipcRenderer.invoke("dialog:select-directory"),
		selectFile: (): Promise<string | null> => ipcRenderer.invoke("dialog:select-file")
	},
	files: {
		saveScopeFile: (input: SaveScopeFileInput): Promise<SaveScopeFileResult> =>
			ipcRenderer.invoke("scope-file:save", input)
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
	},

	workspaces: {
		list: (input: ProjectWorkspaceInput): Promise<WorkspaceRow[]> =>
			ipcRenderer.invoke("workspace:list", input),
		active: (input: ProjectWorkspaceInput): Promise<WorkspaceRow> =>
			ipcRenderer.invoke("workspace:active", input),
		create: (input: CreateWorkspaceInput): Promise<WorkspaceRow> =>
			ipcRenderer.invoke("workspace:create", input),
		update: (input: UpdateWorkspaceInput): Promise<WorkspaceRow> =>
			ipcRenderer.invoke("workspace:update", input),
		activate: (input: WorkspaceIdInput): Promise<WorkspaceRow> =>
			ipcRenderer.invoke("workspace:activate", input)
	},
	settings: {
		get: (key: string): Promise<string> => ipcRenderer.invoke("setting:get", key),
		update: (input: UpdateSettingInput): Promise<string> =>
			ipcRenderer.invoke("setting:update", input)
	},
	agents: {
		list: (projectId: string): Promise<AgentRow[]> => ipcRenderer.invoke("agent:list", projectId),
		create: (input: CreateAgentInput): Promise<AgentRow> =>
			ipcRenderer.invoke("agent:create", input),
		delete: (id: string): Promise<void> => ipcRenderer.invoke("agent:delete", id)
	},
	tasks: {
		list: (agentId: string): Promise<TaskRow[]> => ipcRenderer.invoke("task:list", agentId),
		create: (input: CreateTaskInput): Promise<TaskRow> => ipcRenderer.invoke("task:create", input)
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
