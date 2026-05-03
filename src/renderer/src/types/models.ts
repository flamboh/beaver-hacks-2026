export type WorkbenchTab = "control-panel" | "review" | "agents" | "settings"

export type ProjectRow = {
	id: string
	name: string
	path: string
	createdAt: string
	accessed: string
}

export type AgentRow = {
	id: string
	name: string
	project_id: string
	workspace_id: string | null
	provider: "codex" | "claude"
	model: string
	scope_path: string
	effort: string
}

export type TaskRow = {
	id: string
	batch_id: string
	agent_id: string
	turn_id: string | null
	status: string
	description: string
}

export type BatchRow = {
	id: string
	agent_id: string
	summary: string
}
