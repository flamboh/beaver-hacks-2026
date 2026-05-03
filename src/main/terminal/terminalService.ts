import { spawn } from "node:child_process"
import type { TerminalRunInput, TerminalRunResult } from "./contracts"

const OUTPUT_LIMIT = 100_000
const ANSI_CSI_PATTERN = new RegExp(String.raw`\u001B\[[0-?]*[ -/]*[@-~]`, "g")
const ANSI_OSC_PATTERN = new RegExp(String.raw`\u001B\][^\u0007]*(?:\u0007|\u001B\\)`, "g")
const ANSI_SINGLE_PATTERN = new RegExp(String.raw`\u001B[@-Z\\-_]`, "g")

function trimOutput(value: string): string {
	if (value.length <= OUTPUT_LIMIT) return value
	return value.slice(-OUTPUT_LIMIT)
}

function normalizeTerminalOutput(value: string): string {
	return value
		.replace(ANSI_OSC_PATTERN, "")
		.replace(ANSI_CSI_PATTERN, "")
		.replace(ANSI_SINGLE_PATTERN, "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "")
}

export class TerminalService {
	run(input: TerminalRunInput): Promise<TerminalRunResult> {
		const command = input.command.trim()
		if (!command) throw new Error("Command is required.")

		const shell =
			process.platform === "win32"
				? (process.env.ComSpec ?? "cmd.exe")
				: (process.env.SHELL ?? "/bin/zsh")
		const args = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-lc", command]
		const child = spawn(shell, args, {
			cwd: input.cwd,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"]
		})

		return new Promise((resolve, reject) => {
			let stdout = ""
			let stderr = ""

			child.stdout?.on("data", (chunk: Buffer) => {
				stdout = trimOutput(`${stdout}${chunk.toString()}`)
			})
			child.stderr?.on("data", (chunk: Buffer) => {
				stderr = trimOutput(`${stderr}${chunk.toString()}`)
			})
			child.on("error", reject)
			child.on("close", (exitCode) => {
				resolve({
					stdout: normalizeTerminalOutput(stdout).trimEnd(),
					stderr: normalizeTerminalOutput(stderr).trimEnd(),
					exitCode
				})
			})
		})
	}
}
