import type { ProjectRow, WorkspaceRow } from "./contracts"

export interface ProjectTableRow {
	id: string
	name: string
	path: string
	created_at: string
	accessed: string
}

export interface WorkspaceTableRow {
	id: string
	project_id: string
	name: string
	path: string
	git_root: string | null
	active: number
	created_at: string
	accessed: string
}

export function toProjectRow(row: ProjectTableRow): ProjectRow {
	return {
		id: row.id,
		name: row.name,
		path: row.path,
		createdAt: row.created_at,
		accessed: row.accessed
	}
}

export function toWorkspaceRow(row: WorkspaceTableRow): WorkspaceRow {
	return {
		id: row.id,
		projectId: row.project_id,
		name: row.name,
		path: row.path,
		gitRoot: row.git_root,
		active: row.active === 1,
		createdAt: row.created_at,
		accessed: row.accessed
	}
}
