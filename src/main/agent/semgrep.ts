import { spawn } from "node:child_process"

export interface SemgrepFinding {
	ruleId: string
	path: string
	line: number | null
	severity: string
	message: string
}

export interface SemgrepScanSummary {
	findingCount: number
	findings: SemgrepFinding[]
	command: string
}

export interface SemgrepAvailability {
	available: boolean
	command: string
	detail: string | null
}

const SEMGREP_TIMEOUT_MS = 180_000
const SEMGREP_AVAILABILITY_TIMEOUT_MS = 5_000
const MAX_FINDINGS_IN_PROMPT = 12
const SEMGREP_CONFIG = "p/default"

function readPath(payload: unknown, path: string[]): unknown {
	let cursor = payload as Record<string, unknown> | undefined | null
	for (const segment of path) {
		cursor = cursor?.[segment] as Record<string, unknown> | undefined | null
	}
	return cursor
}

function readText(value: unknown): string | null {
	if (value === undefined || value === null) return null
	return String(value)
}

function readArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : []
}

function readLineNumber(value: unknown): number | null {
	const text = readText(value)
	if (!text) return null
	const line = Number(text)
	if (!Number.isFinite(line) || line < 1) return null
	return Math.trunc(line)
}

function normalizeMessage(message: string): string {
	return message.replace(/\s+/g, " ").trim()
}

function semgrepFinding(result: unknown, index: number): SemgrepFinding {
	return {
		ruleId: readText(readPath(result, ["check_id"])) ?? `semgrep-rule-${index + 1}`,
		path: readText(readPath(result, ["path"])) ?? "(unknown file)",
		line: readLineNumber(readPath(result, ["start", "line"])),
		severity: (readText(readPath(result, ["extra", "severity"])) ?? "UNKNOWN").toUpperCase(),
		message: normalizeMessage(
			readText(readPath(result, ["extra", "message"])) ?? "Semgrep reported a finding."
		)
	}
}

function parseSemgrepSummary(output: string, command: string): SemgrepScanSummary {
	const parsed = JSON.parse(output) as Record<string, unknown>
	const results = readArray(readPath(parsed, ["results"]))
	return {
		findingCount: results.length,
		findings: results.map(semgrepFinding).slice(0, MAX_FINDINGS_IN_PROMPT),
		command
	}
}

function semgrepFailureMessage(command: string, code: number | null, stderr: string): string {
	const suffix = stderr.trim() ? ` ${stderr.trim()}` : ""
	return `Semgrep security mode is enabled, but "${command}" failed with code ${code ?? "unknown"}.${suffix}`
}

function semgrepCommand(): string {
	return process.env.SEMGREP_BIN?.trim() || "semgrep"
}

export async function checkSemgrepAvailability(): Promise<SemgrepAvailability> {
	const command = semgrepCommand()
	return new Promise<SemgrepAvailability>((resolve) => {
		let stdout = ""
		let stderr = ""
		let settled = false
		const child = spawn(command, ["--version"], {
			cwd: process.cwd(),
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"]
		})

		const timeout = setTimeout(() => {
			if (settled) return
			settled = true
			child.kill("SIGTERM")
			resolve({
				available: false,
				command,
				detail: `Timed out after ${SEMGREP_AVAILABILITY_TIMEOUT_MS}ms while checking Semgrep.`
			})
		}, SEMGREP_AVAILABILITY_TIMEOUT_MS)

		child.stdout.setEncoding("utf8")
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk
		})

		child.stderr.setEncoding("utf8")
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk
		})

		child.on("error", (error: unknown) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			resolve({
				available: false,
				command,
				detail: error instanceof Error ? error.message : String(error)
			})
		})

		child.on("close", (code: number | null) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			if (code === 0) {
				const version = stdout.trim().split(/\r?\n/).at(-1) ?? "Semgrep detected"
				resolve({
					available: true,
					command,
					detail: version
				})
				return
			}

			const failure = stderr.trim() || stdout.trim() || `Exit code ${code ?? "unknown"}`
			resolve({
				available: false,
				command,
				detail: failure
			})
		})
	})
}

export async function runSemgrepScan(cwd: string): Promise<SemgrepScanSummary> {
	const command = semgrepCommand()
	const args = ["scan", "--config", SEMGREP_CONFIG, "--json", "--metrics=off", "."]
	const commandLabel = `${command} ${args.join(" ")}`

	return new Promise<SemgrepScanSummary>((resolve, reject) => {
		let stdout = ""
		let stderr = ""
		let settled = false
		const child = spawn(command, args, {
			cwd,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"]
		})

		const timeout = setTimeout(() => {
			if (settled) return
			settled = true
			child.kill("SIGTERM")
			reject(new Error(`Semgrep security mode timed out after ${SEMGREP_TIMEOUT_MS}ms.`))
		}, SEMGREP_TIMEOUT_MS)

		child.stdout.setEncoding("utf8")
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk
		})

		child.stderr.setEncoding("utf8")
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk
		})

		child.on("error", (error: unknown) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			const message = error instanceof Error ? error.message : String(error)
			reject(
				new Error(
					`Semgrep security mode requires Semgrep CLI. Failed to start "${commandLabel}": ${message}`
				)
			)
		})

		child.on("close", (code: number | null) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			if (code !== 0 && code !== 1) {
				reject(new Error(semgrepFailureMessage(commandLabel, code, stderr)))
				return
			}

			const output = stdout.trim()
			if (output.length > 0) {
				try {
					resolve(parseSemgrepSummary(output, commandLabel))
					return
				} catch {
					// Fall through to command failure message for malformed output.
				}
			}

			reject(new Error(semgrepFailureMessage(commandLabel, code, stderr)))
		})
	})
}

export function semgrepSummaryForPrompt(summary: SemgrepScanSummary): string {
	if (summary.findingCount === 0) {
		return "Semgrep reported 0 findings."
	}

	const lines = summary.findings.map((finding) => {
		const location = finding.line ? `${finding.path}:${finding.line}` : finding.path
		return `- [${finding.severity}] ${location} (${finding.ruleId}) ${finding.message}`
	})
	return [`Semgrep reported ${summary.findingCount} findings.`, ...lines].join("\n")
}
