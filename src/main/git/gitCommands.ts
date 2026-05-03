import { execFile } from "node:child_process"

export interface GitResult {
	stdout: string
	stderr: string
}

const DEFAULT_TIMEOUT_MS = 30_000
export const DEFAULT_MAX_BUFFER = 2 * 1024 * 1024

export function runGit(
	cwd: string,
	args: readonly string[],
	maxBuffer = DEFAULT_MAX_BUFFER
): Promise<GitResult> {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			[...args],
			{ cwd, timeout: DEFAULT_TIMEOUT_MS, maxBuffer },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error((stderr || error.message).trim()))
					return
				}
				resolve({ stdout, stderr })
			}
		)
	})
}

export function runGitAllowExit(
	cwd: string,
	args: readonly string[],
	allowedCodes: readonly string[],
	maxBuffer = DEFAULT_MAX_BUFFER
): Promise<GitResult> {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			[...args],
			{ cwd, timeout: DEFAULT_TIMEOUT_MS, maxBuffer },
			(error, stdout, stderr) => {
				if (error && !allowedCodes.includes(String((error as { code?: unknown }).code))) {
					reject(new Error((stderr || error.message).trim()))
					return
				}
				resolve({ stdout, stderr })
			}
		)
	})
}

export function runGh(cwd: string, args: readonly string[]): Promise<GitResult> {
	return new Promise((resolve, reject) => {
		execFile(
			"gh",
			[...args],
			{ cwd, timeout: DEFAULT_TIMEOUT_MS, maxBuffer: DEFAULT_MAX_BUFFER },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(normalizeGhError(stderr || error.message)))
					return
				}
				resolve({ stdout, stderr })
			}
		)
	})
}

function normalizeGhError(message: string): string {
	const lower = message.toLowerCase()
	if (lower.includes("not found") && lower.includes("gh")) {
		return "GitHub CLI (`gh`) is required but not available on PATH."
	}
	if (
		lower.includes("not logged in") ||
		lower.includes("gh auth login") ||
		lower.includes("no oauth token")
	) {
		return "GitHub CLI is not authenticated. Run `gh auth login` and retry."
	}
	return message.trim() || "GitHub CLI command failed."
}
