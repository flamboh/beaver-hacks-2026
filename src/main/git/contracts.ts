export interface GitFileChange {
	path: string
	status: string
}

export interface GitBranch {
	name: string
	current: boolean
}

export interface GitStatusSnapshot {
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

export interface GitCommitMessage {
	subject: string
	body: string
}

export interface GitCheckoutInput {
	cwd: string
	branch: string
}

export interface GitCreateBranchInput {
	cwd: string
	branch: string
}

export interface GitCommitAllInput {
	cwd: string
	subject: string
	body?: string
}

export interface GitCommitResult {
	commitSha: string
	status: GitStatusSnapshot
}

export interface GitPushInput {
	cwd: string
}

export interface GitPushResult {
	status: GitStatusSnapshot
}
