import { ElectronAPI } from "@electron-toolkit/preload"
import type {
	AgentModelOption,
	AgentProvider,
	AgentSnapshot,
	FindMcpsInput,
	SemgrepStatus,
	FindSkillsInput,
	InstallSkillInput,
	SpawnThreadInput,
	StopTurnInput,
	StartTurnInput,
	UninstallSkillInput
} from "../main/agent/ipc"
import type {
	ComposerFileSuggestion,
	ComposerMentionSuggestion,
	ComposerSearchFilesInput
} from "../main/composer/ipc"
import type {
	AgentRow,
	CreateAgentInput,
	CreateProjectInput,
	CreateTaskInput,
	CreateToolCardInput,
	CreateWorkspaceInput,
	DatabaseInfo,
	DeleteWorkspaceResult,
	ProjectIdInput,
	ProjectRow,
	ProjectWorkspaceInput,
	ReorderProjectsInput,
	ReorderWorkspacesInput,
	TaskRow,
	ToolCardRow,
	UpdateAgentInput,
	UpdateProjectInput,
	UpdateSettingInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput,
	WorkspaceRow
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
	GitReviewFileInput,
	GitReviewFilesInput,
	GitRunStackedActionInput,
	GitRunStackedActionResult,
	GitStackedActionProgressEvent,
	GitStatusSnapshot,
	GitWorkingTreeDiffSnapshot
} from "../main/git/ipc"
import type { SaveScopeFileInput, SaveScopeFileResult } from "../main/scopeFiles/ipc"
import type {
	TerminalCreateInput,
	TerminalCreateResult,
	TerminalDisposeInput,
	TerminalResizeInput,
	TerminalRunInput,
	TerminalRunResult,
	TerminalWriteInput
} from "../main/terminal/ipc"

interface BeaverApi {
	agent: {
		getSnapshot: () => Promise<AgentSnapshot>
		listModels: (provider: AgentProvider) => Promise<AgentModelOption[]>
		getSemgrepStatus: () => Promise<SemgrepStatus>
		startTurn: (input: StartTurnInput) => Promise<AgentSnapshot>
		stopTurn: (input: StopTurnInput) => Promise<AgentSnapshot>
		findSkills: (input: FindSkillsInput) => Promise<AgentSnapshot>
		findMcps: (input: FindMcpsInput) => Promise<AgentSnapshot>
		installSkill: (input: InstallSkillInput) => Promise<AgentSnapshot>
		uninstallSkill: (input: UninstallSkillInput) => Promise<AgentSnapshot>
		spawnThread: (input: SpawnThreadInput) => Promise<AgentSnapshot>
		onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => () => void
	}
	composer: {
		searchFiles: (input: ComposerSearchFilesInput) => Promise<ComposerFileSuggestion[]>
		listMentions: (cwd: string) => Promise<ComposerMentionSuggestion[]>
	}
	git: {
		getStatus: (workspaceId: string) => Promise<GitStatusSnapshot>
		getWorkingTreeDiff: (workspaceId: string) => Promise<GitWorkingTreeDiffSnapshot>
		checkout: (input: GitCheckoutInput) => Promise<GitStatusSnapshot>
		createBranch: (input: GitCreateBranchInput) => Promise<GitStatusSnapshot>
		acceptFile: (input: GitReviewFileInput) => Promise<GitStatusSnapshot>
		acceptFiles: (input: GitReviewFilesInput) => Promise<GitStatusSnapshot>
		denyFile: (input: GitReviewFileInput) => Promise<GitStatusSnapshot>
		denyFiles: (input: GitReviewFilesInput) => Promise<GitStatusSnapshot>
		generateCommitMessage: (workspaceId: string) => Promise<GitCommitMessage>
		generateDiffTour: (workspaceId: string) => Promise<GitDiffTour>
		commitAll: (input: GitCommitAllInput) => Promise<GitCommitResult>
		push: (input: GitPushInput) => Promise<GitPushResult>
		runStackedAction: (input: GitRunStackedActionInput) => Promise<GitRunStackedActionResult>
		onStackedActionProgress: (
			listener: (event: GitStackedActionProgressEvent) => void
		) => () => void
	}
	db: {
		getInfo: () => Promise<DatabaseInfo>
	}
	devServer: {
		launchProject: (input: LaunchProjectDevServerInput) => Promise<ProjectDevServerLaunch>
		getProjectStatus: (input: ProjectDevServerInput) => Promise<ProjectDevServerStatus>
		stopProject: (input: ProjectDevServerInput) => Promise<ProjectDevServerStatus>
	}
	dialog: {
		selectDirectory: () => Promise<string | null>
		selectFile: () => Promise<string | null>
	}
	files: {
		saveScopeFile: (input: SaveScopeFileInput) => Promise<SaveScopeFileResult>
	}
	projects: {
		list: () => Promise<ProjectRow[]>
		get: (input: ProjectIdInput) => Promise<ProjectRow>
		create: (input: CreateProjectInput) => Promise<ProjectRow>
		update: (input: UpdateProjectInput) => Promise<ProjectRow>
		reorder: (input: ReorderProjectsInput) => Promise<ProjectRow[]>
		touch: (input: ProjectIdInput) => Promise<ProjectRow>
		delete: (input: ProjectIdInput) => Promise<void>
	}

	workspaces: {
		list: (input: ProjectWorkspaceInput) => Promise<WorkspaceRow[]>
		active: (input: ProjectWorkspaceInput) => Promise<WorkspaceRow>
		create: (input: CreateWorkspaceInput) => Promise<WorkspaceRow>
		update: (input: UpdateWorkspaceInput) => Promise<WorkspaceRow>
		reorder: (input: ReorderWorkspacesInput) => Promise<void>
		activate: (input: WorkspaceIdInput) => Promise<WorkspaceRow>
		touchPrompted: (input: WorkspaceIdInput) => Promise<WorkspaceRow>
		delete: (input: WorkspaceIdInput) => Promise<DeleteWorkspaceResult>
	}
	settings: {
		get: (key: string) => Promise<string>
		update: (input: UpdateSettingInput) => Promise<string>
	}
	agents: {
		list: (projectId: string) => Promise<AgentRow[]>
		create: (input: CreateAgentInput) => Promise<AgentRow>
		update: (input: UpdateAgentInput) => Promise<AgentRow>
		delete: (id: string) => Promise<void>
	}
	toolCards: {
		list: (projectId: string) => Promise<ToolCardRow[]>
		create: (input: CreateToolCardInput) => Promise<ToolCardRow>
		delete: (id: string) => Promise<void>
	}
	tasks: {
		list: (agentId: string) => Promise<TaskRow[]>
		create: (input: CreateTaskInput) => Promise<TaskRow>
	}
	terminal: {
		run: (input: TerminalRunInput) => Promise<TerminalRunResult>
		session: {
			create: (input: TerminalCreateInput) => Promise<TerminalCreateResult>
			write: (input: TerminalWriteInput) => void
			resize: (input: TerminalResizeInput) => void
			dispose: (input: TerminalDisposeInput) => void
			onData: (sessionId: string, listener: (data: string) => void) => () => void
			onExit: (
				sessionId: string,
				listener: (info: { exitCode: number; signal: number | null }) => void
			) => () => void
		}
	}
}

declare global {
	interface Window {
		electron: ElectronAPI
		api: BeaverApi
	}
}
