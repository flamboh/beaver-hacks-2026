export interface DatabaseInfo {
	path: string
	schemaVersion: number
}

export interface CreateProjectInput {
	name: string
	path: string
	enterDevAction?: string
}

export interface UpdateProjectInput {
	id: string
	name: string
	path: string
	enterDevAction?: string
}

export interface ProjectIdInput {
	id: string
}

export interface ReorderProjectsInput {
	ids: string[]
}

export interface ReorderWorkspacesInput {
	ids: string[]
}

export interface ProjectWorkspaceInput {
	projectId: string
}

export interface CreateWorkspaceInput {
	projectId: string
	name: string
	path?: string
	sourceWorkspaceId?: string
	branch?: string
}

export interface WorkspaceIdInput {
	id: string
}

export interface WorkspacePromptInput {
	id: string
}

export interface DeleteWorkspaceResult {
	activeWorkspace: WorkspaceRow
	deletedWorkspaceId: string
}

export interface UpdateWorkspaceInput {
	id: string
	name?: string
	path?: string
	railColor?: string
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
	enterDevAction: string
	createdAt: string
	accessed: string
	sortOrder: number
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
	lastPromptedAt: string
	railColor: string
	sortOrder: number
}

export type WorkspaceCreationMode = "existing-directory" | "new-directory" | "git-worktree"

export interface WorkspaceCreationResult {
	workspace: WorkspaceRow
	mode: WorkspaceCreationMode
	gitRoot: string | null
	branch: string | null
}

export type AgentProvider = "codex" | "claude"
export type ToolCardKind = "terminal" | "browser"

export type AgentRow = {
	id: string
	name: string
	project_id: string
	workspace_id: string | null
	provider: AgentProvider
	model: string
	scope_path: string
	effort: string
	thread_id: string | null
	layout_x: number
	layout_y: number
}

export type ToolCardRow = {
	id: string
	project_id: string
	workspace_id: string
	kind: ToolCardKind
	layout_x: number
	layout_y: number
	created_at: string
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
