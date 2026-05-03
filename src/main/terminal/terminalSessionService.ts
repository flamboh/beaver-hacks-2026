import { randomUUID } from "node:crypto"
import { spawn, type IPty } from "node-pty"
import type { WebContents } from "electron"
import type {
	TerminalCreateInput,
	TerminalDisposeInput,
	TerminalResizeInput,
	TerminalWriteInput
} from "./contracts"

interface Session {
	pty: IPty
	webContents: WebContents
}

export class TerminalSessionService {
	private sessions = new Map<string, Session>()

	create(input: TerminalCreateInput, webContents: WebContents): { sessionId: string } {
		const sessionId = randomUUID()
		const shell =
			process.platform === "win32"
				? (process.env.ComSpec ?? "cmd.exe")
				: (process.env.SHELL ?? "/bin/zsh")
		const args: string[] = process.platform === "win32" ? [] : ["-l"]
		const pty = spawn(shell, args, {
			name: "xterm-256color",
			cols: Math.max(1, Math.floor(input.cols)),
			rows: Math.max(1, Math.floor(input.rows)),
			cwd: input.cwd,
			env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" }
		})

		pty.onData((data) => {
			if (webContents.isDestroyed()) return
			webContents.send(`terminal:data:${sessionId}`, data)
		})

		pty.onExit(({ exitCode, signal }) => {
			if (!webContents.isDestroyed()) {
				webContents.send(`terminal:exit:${sessionId}`, { exitCode, signal: signal ?? null })
			}
			this.sessions.delete(sessionId)
		})

		webContents.once("destroyed", () => this.dispose({ sessionId }))

		this.sessions.set(sessionId, { pty, webContents })
		return { sessionId }
	}

	write(input: TerminalWriteInput): void {
		this.sessions.get(input.sessionId)?.pty.write(input.data)
	}

	resize(input: TerminalResizeInput): void {
		const session = this.sessions.get(input.sessionId)
		if (!session) return
		session.pty.resize(Math.max(1, Math.floor(input.cols)), Math.max(1, Math.floor(input.rows)))
	}

	dispose(input: TerminalDisposeInput): void {
		const session = this.sessions.get(input.sessionId)
		if (!session) return
		this.sessions.delete(input.sessionId)
		try {
			session.pty.kill()
		} catch {
			// pty may already be dead
		}
	}

	disposeAll(): void {
		for (const id of this.sessions.keys()) this.dispose({ sessionId: id })
	}
}
