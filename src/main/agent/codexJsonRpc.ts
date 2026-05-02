import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { EventEmitter } from "node:events"
import { randomUUID } from "node:crypto"

interface PendingRequest {
	resolve: (value: unknown) => void
	reject: (error: Error) => void
}

export interface CodexWireMessage {
	id?: string | number
	method?: string
	params?: unknown
	result?: unknown
	error?: { message?: string; code?: number; data?: unknown }
}

export class CodexJsonRpc extends EventEmitter {
	private child: ChildProcessWithoutNullStreams | null = null
	private nextRequestId = 1
	private pending = new Map<string, PendingRequest>()
	private buffer = ""

	constructor(
		private readonly options: {
			command: string
			cwd: string
			env?: NodeJS.ProcessEnv
		}
	) {
		super()
	}

	start(): void {
		if (this.child) return

		this.child = spawn(this.options.command, ["app-server"], {
			cwd: this.options.cwd,
			env: { ...process.env, ...this.options.env },
			stdio: "pipe"
		})

		this.child.stdout.setEncoding("utf8")
		this.child.stdout.on("data", (chunk: string) => this.readChunk(chunk))
		this.child.stderr.setEncoding("utf8")
		this.child.stderr.on("data", (chunk: string) => this.emit("stderr", chunk))
		this.child.on("exit", (code) => {
			this.rejectAll(new Error(`Codex app-server exited with code ${code ?? "unknown"}`))
			this.emit("exit", code)
			this.child = null
		})
		this.child.on("error", (error) => {
			this.rejectAll(error)
			this.emit("error", error)
		})
	}

	async request(method: string, params?: unknown): Promise<unknown> {
		this.start()

		const id = this.nextRequestId++
		const key = String(id)
		const response = new Promise<unknown>((resolve, reject) => {
			this.pending.set(key, { resolve, reject })
		})

		this.write({ id, method, params })
		return response
	}

	notify(method: string, params?: unknown): void {
		this.start()
		this.write({ method, params })
	}

	respond(id: string | number, result: unknown): void {
		this.write({ id, result })
	}

	respondError(id: string | number, message: string): void {
		this.write({
			id,
			error: {
				code: -32601,
				message
			}
		})
	}

	stop(): void {
		this.rejectAll(new Error("Codex app-server stopped"))
		this.child?.kill()
		this.child = null
	}

	private write(message: CodexWireMessage): void {
		const child = this.child
		if (!child) throw new Error("Codex app-server is not running")

		const cleanMessage = Object.fromEntries(
			Object.entries(message).filter(([, value]) => value !== undefined)
		)
		child.stdin.write(`${JSON.stringify(cleanMessage)}\n`)
	}

	private readChunk(chunk: string): void {
		this.buffer += chunk
		const lines = this.buffer.split("\n")
		this.buffer = lines.pop() ?? ""

		for (const line of lines) {
			const trimmed = line.trim()
			if (!trimmed) continue

			try {
				this.routeMessage(JSON.parse(trimmed) as CodexWireMessage)
			} catch (error) {
				this.emit("protocol-error", error)
			}
		}
	}

	private routeMessage(message: CodexWireMessage): void {
		if (message.id !== undefined && message.method) {
			this.emit("request", message)
			return
		}

		if (message.id !== undefined) {
			const pending = this.pending.get(String(message.id))
			if (!pending) return

			this.pending.delete(String(message.id))
			if (message.error) {
				pending.reject(new Error(message.error.message ?? "Codex app-server request failed"))
				return
			}
			pending.resolve(message.result)
			return
		}

		if (message.method) {
			this.emit("notification", message)
		}
	}

	private rejectAll(error: Error): void {
		for (const [id, pending] of this.pending.entries()) {
			this.pending.delete(id)
			pending.reject(error)
		}
	}
}

export function generatedId(prefix: string): string {
	return `${prefix}:${randomUUID()}`
}
