export interface DatabaseInfo {
	path: string
	schemaVersion: number
}

export interface ProjectRow {
	id: string
	name: string
	path: string
	createdAt: string
	accessed: string
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
