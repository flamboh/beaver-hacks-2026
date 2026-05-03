export type WorkbenchTab = "control-panel" | "gallery" | "review" | "agents" | "settings"

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
	model: string
	scope_path: string
	effort: string
}

export type TaskRow = {
	id: string
	batch_id: string
	agent_id: string
	status: string
	description: string
}

export type BatchRow = {
	id: string
	agent_id: string
	summary: string
}
