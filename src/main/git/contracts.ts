export interface GitFileChange {
	path: string
	status: string
}

export interface GitBranch {
	name: string
	current: boolean
}

export interface GitStatusSnapshot {
	workspaceId: string | null
	workspacePath: string | null
	cwd: string
	isRepo: boolean
	branch: string | null
	upstream: string | null
	ahead: number
	behind: number
	hasRemote: boolean
	files: GitFileChange[]
	insertions: number
	deletions: number
	branches: GitBranch[]
	updatedAt: string
}

export interface GitWorkingTreeDiffSnapshot {
	workspaceId: string | null
	workspacePath: string | null
	cwd: string
	isRepo: boolean
	patch: string
	updatedAt: string
}

export interface GitCommitMessage {
	subject: string
	body: string
}

export interface GitDiffTour {
	tour: string
	updatedAt: string
}

export interface GitCheckoutInput {
	workspaceId: string
	branch: string
}

export interface GitCreateBranchInput {
	workspaceId: string
	branch: string
}

export interface GitCommitAllInput {
	workspaceId: string
	subject: string
	body?: string
}

export interface GitCommitResult {
	commitSha: string
	status: GitStatusSnapshot
}

export interface GitPushInput {
	workspaceId: string
}

export interface GitPushResult {
	status: GitStatusSnapshot
}
