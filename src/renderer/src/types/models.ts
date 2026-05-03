export type WorkbenchTab = "control-panel" | "review" | "agents" | "skills" | "settings"
export type WorkspaceSortMode = "project" | "workspace"

export type ProjectRow = {
	id: string
	name: string
	path: string
	enterDevAction: string
	createdAt: string
	accessed: string
	sortOrder: number
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
	thread_id: string | null
	layout_x: number
	layout_y: number
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
