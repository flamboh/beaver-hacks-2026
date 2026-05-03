export type AgentRole = "user" | "assistant" | "system"

export type AgentProvider = "codex" | "claude"

export type AgentSessionStatus = "idle" | "starting" | "ready" | "running" | "stopped" | "error"

export type AgentRuntimeMode = "full-access" | "auto-accept-edits" | "approval-required"

export type AgentPlanItemStatus = "pending" | "in_progress" | "completed" | "cancelled"

export interface AgentPlanItem {
	id: string
	title: string
	status: AgentPlanItemStatus
	detail: string | null
	updatedAt: string
}

export interface AgentPlan {
	items: AgentPlanItem[]
	source: AgentProvider | "user" | null
	updatedAt: string | null
}

export interface AgentMessage {
	id: string
	role: AgentRole
	text: string
	streaming: boolean
	createdAt: string
	updatedAt: string
	turnId: string | null
}

export interface AgentActivity {
	id: string
	kind: string
	summary: string
	payload: unknown
	createdAt: string
	turnId: string | null
}

export interface AgentSkillSuggestion {
	id: string
	slug: string
	name: string
	source: string
	installs: number
	sourceType: "github" | "well-known" | string
	installUrl: string | null
	url: string
	description: string
	score: number
	installed: boolean
}

export interface AgentMcpSuggestion {
	id: string
	name: string
	owner: string
	repo: string
	url: string
	description: string
	stars: number
	language: string | null
	topics: string[]
	installHint: string
	reason: string
	score: number
}

export interface AgentModelOption {
	id: string
	label: string
	provider: AgentProvider
	isDefault: boolean
	reasoningEfforts: AgentRunSettingOption[]
	speedTiers: AgentRunSettingOption[]
}

export interface AgentRunSettingOption {
	id: string
	label: string
	description: string | null
	isDefault: boolean
}

export interface AgentSession {
	status: AgentSessionStatus
	provider: AgentProvider
	model: string | null
	activeTurnId: string | null
	lastError: string | null
	updatedAt: string
}

export interface AgentThread {
	id: string
	title: string
	cwd: string
	provider: AgentProvider
	model: string | null
	runtimeMode: AgentRuntimeMode
	messages: AgentMessage[]
	activities: AgentActivity[]
	plan: AgentPlan
	suggestedSkills: AgentSkillSuggestion[]
	suggestedMcps: AgentMcpSuggestion[]
	session: AgentSession | null
	createdAt: string
	updatedAt: string
}

export interface AgentSnapshot {
	threads: AgentThread[]
	activeThreadId: string | null
	updatedAt: string
}

export interface StartTurnInput {
	threadId?: string
	cwd?: string
	prompt: string
	provider?: AgentProvider
	model?: string
	effort?: string
	speedTier?: string | null
	runtimeMode?: AgentRuntimeMode
}

export interface StopTurnInput {
	threadId: string
}

export interface FindSkillsInput {
	threadId?: string
	cwd?: string
	prompt?: string
	runtimeMode?: AgentRuntimeMode
}

export interface FindMcpsInput {
	threadId?: string
	cwd?: string
	prompt?: string
	runtimeMode?: AgentRuntimeMode
}

export interface InstallSkillInput {
	threadId: string
	skillId: string
}

export interface UninstallSkillInput {
	threadId: string
	cwd: string
	skillPath: string
}

export interface SpawnThreadInput {
	threadId: string
	cwd: string
	name?: string
	model?: string
}

export interface ProviderSessionStartInput {
	threadId: string
	cwd: string
	provider: AgentProvider
	model?: string
	runtimeMode: AgentRuntimeMode
}

export interface ProviderSendTurnInput {
	threadId: string
	prompt: string
	model?: string
	effort?: string
	speedTier?: string | null
}

export interface ProviderTurnStartResult {
	threadId: string
	turnId: string
	resumeCursor?: unknown
}

export type ProviderRuntimeEvent =
	| {
			type: "session.state.changed"
			threadId: string
			createdAt: string
			payload: { status: AgentSessionStatus; reason?: string; model?: string | null }
	  }
	| {
			type: "turn.started"
			threadId: string
			turnId: string
			createdAt: string
			payload: Record<string, never>
	  }
	| {
			type: "turn.completed"
			threadId: string
			turnId: string | null
			createdAt: string
			payload: { status: "completed" | "failed" | "cancelled" | "interrupted"; error?: string }
	  }
	| {
			type: "assistant.delta"
			threadId: string
			turnId: string | null
			itemId: string | null
			createdAt: string
			payload: { delta: string }
	  }
	| {
			type: "activity"
			threadId: string
			turnId: string | null
			createdAt: string
			payload: { kind: string; summary: string; detail?: unknown }
	  }
	| {
			type: "plan.updated"
			threadId: string
			turnId: string | null
			createdAt: string
			payload: { plan: AgentPlan }
	  }
	| {
			type: "runtime.error"
			threadId: string
			turnId: string | null
			createdAt: string
			payload: { message: string }
	  }

export interface ProviderAdapter {
	startSession(input: ProviderSessionStartInput): Promise<AgentSession>
	sendTurn(input: ProviderSendTurnInput): Promise<ProviderTurnStartResult>
	stopSession(threadId: string): Promise<void>
	listModels?(): Promise<AgentModelOption[]>
	onEvent(listener: (event: ProviderRuntimeEvent) => void): () => void
}
