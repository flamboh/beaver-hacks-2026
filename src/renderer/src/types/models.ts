export type WorkbenchTab = "control-panel" | "gallery" | "review" | "agents" | "settings"

export type ProjectRow = {
	id: string
	name: string
	path: string
	accessed: Date
	created_at: Date
}

export type Agent = {
	id: string
	name: string
	project_id: string
	model: string
	scope_path: string
	effort: string
}

export type Task = {
	id: string
	agent_id: string
	status: string
	description: string
}
