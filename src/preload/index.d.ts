import { ElectronAPI } from "@electron-toolkit/preload"
import type {
	AgentSnapshot,
	FindSkillsInput,
	InstallSkillInput,
	StartTurnInput
} from "../main/agent/ipc"

interface DatabaseInfo {
	path: string
	schemaVersion: number
}

interface ProjectRow {
	id: string
	name: string
	path: string
	createdAt: string
	accessed: string
}

interface CreateProjectInput {
	name: string
	path: string
}

interface UpdateProjectInput {
	id: string
	name: string
	path: string
}

interface ProjectIdInput {
	id: string
}

interface BeaverApi {
	agent: {
		getSnapshot: () => Promise<AgentSnapshot>
		startTurn: (input: StartTurnInput) => Promise<AgentSnapshot>
		findSkills: (input: FindSkillsInput) => Promise<AgentSnapshot>
		installSkill: (input: InstallSkillInput) => Promise<AgentSnapshot>
		onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => () => void
	}
	db: {
		getInfo: () => Promise<DatabaseInfo>
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
