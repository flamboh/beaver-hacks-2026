import { ElectronAPI } from "@electron-toolkit/preload"
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
	GitDiffTour,
	GitPushInput,
	GitPushResult,
	GitStatusSnapshot,
	GitWorkingTreeDiffSnapshot
} from "../main/git/ipc"
import type { SaveScopeFileInput, SaveScopeFileResult } from "../main/scopeFiles/ipc"

interface BeaverApi {
	agent: {
		getSnapshot: () => Promise<AgentSnapshot>
		startTurn: (input: StartTurnInput) => Promise<AgentSnapshot>
		findSkills: (input: FindSkillsInput) => Promise<AgentSnapshot>
		installSkill: (input: InstallSkillInput) => Promise<AgentSnapshot>
		onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => () => void
	}
	git: {
		getStatus: (cwd: string) => Promise<GitStatusSnapshot>
		getWorkingTreeDiff: (cwd?: string) => Promise<GitWorkingTreeDiffSnapshot>
		checkout: (input: GitCheckoutInput) => Promise<GitStatusSnapshot>
		createBranch: (input: GitCreateBranchInput) => Promise<GitStatusSnapshot>
		generateCommitMessage: (cwd: string) => Promise<GitCommitMessage>
		generateDiffTour: (cwd: string) => Promise<GitDiffTour>
		commitAll: (input: GitCommitAllInput) => Promise<GitCommitResult>
		push: (input: GitPushInput) => Promise<GitPushResult>
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
		touch: (input: ProjectIdInput) => Promise<ProjectRow>
		delete: (input: ProjectIdInput) => Promise<void>
	}
}

declare global {
	interface Window {
		electron: ElectronAPI
		api: BeaverApi
	}
}
