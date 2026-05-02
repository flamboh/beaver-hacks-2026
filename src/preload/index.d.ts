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
import type { ReviewDevServerLaunch } from "../main/devServer/ipc"
import type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitCommitMessage,
	GitCommitResult,
	GitCreateBranchInput,
	GitPushInput,
	GitPushResult,
	GitStatusSnapshot
} from "../main/git/ipc"

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
		checkout: (input: GitCheckoutInput) => Promise<GitStatusSnapshot>
		createBranch: (input: GitCreateBranchInput) => Promise<GitStatusSnapshot>
		generateCommitMessage: (cwd: string) => Promise<GitCommitMessage>
		commitAll: (input: GitCommitAllInput) => Promise<GitCommitResult>
		push: (input: GitPushInput) => Promise<GitPushResult>
	}
	db: {
		getInfo: () => Promise<DatabaseInfo>
	}
	devServer: {
		launchReview: () => Promise<ReviewDevServerLaunch>
	}
	projects: {
		list: () => Promise<ProjectRow[]>
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
