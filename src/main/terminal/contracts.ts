export interface TerminalRunInput {
	cwd: string
	command: string
}

export interface TerminalRunResult {
	stdout: string
	stderr: string
	exitCode: number | null
}

export interface TerminalCreateInput {
	cwd: string
	cols: number
	rows: number
}

export interface TerminalCreateResult {
	sessionId: string
}

export interface TerminalWriteInput {
	sessionId: string
	data: string
}

export interface TerminalResizeInput {
	sessionId: string
	cols: number
	rows: number
}

export interface TerminalDisposeInput {
	sessionId: string
}

export interface TerminalDataPayload {
	sessionId: string
	data: string
}

export interface TerminalExitPayload {
	sessionId: string
	exitCode: number
	signal: number | null
}
