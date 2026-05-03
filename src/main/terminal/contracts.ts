export interface TerminalRunInput {
	cwd: string
	command: string
}

export interface TerminalRunResult {
	stdout: string
	stderr: string
	exitCode: number | null
}
