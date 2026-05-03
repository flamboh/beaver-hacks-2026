export interface DatabaseInfo {
	path: string
	schemaVersion: number
}

export interface CreateProjectInput {
	name: string
	path: string
}

export interface UpdateProjectInput {
	id: string
	name: string
	path: string
}

export interface ProjectIdInput {
	id: string
}

export interface ProjectWorkspaceInput {
	projectId: string
}

export interface CreateWorkspaceInput {
	projectId: string
	name: string
	path?: string
}

export interface WorkspaceIdInput {
	id: string
}

export interface UpdateWorkspaceInput {
	id: string
	name: string
	path: string
}

export interface UpdateSettingInput {
	key: string
	value: string
}

// Schemas

export interface ProjectRow {
	id: string
	name: string
	path: string
	createdAt: string
	accessed: string
}

export interface WorkspaceRow {
	id: string
	projectId: string
	name: string
	path: string
	gitRoot: string | null
	active: boolean
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
