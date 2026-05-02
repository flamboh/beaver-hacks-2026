import { EventEmitter } from "node:events"
import { generatedId, CodexJsonRpc, type CodexWireMessage } from "./codexJsonRpc"
import type {
	AgentRuntimeMode,
	AgentSession,
	ProviderAdapter,
	ProviderRuntimeEvent,
	ProviderSendTurnInput,
	ProviderSessionStartInput,
	ProviderTurnStartResult
} from "./contracts"

interface CodexThreadState {
	appThreadId: string
	providerThreadId: string
	cwd: string
	model: string | null
	runtimeMode: AgentRuntimeMode
	session: AgentSession
}

interface CodexThreadStartResponse {
	thread: {
		id: string
	}
	cwd?: string
	model?: string
}

interface CodexTurnStartResponse {
	turn: {
		id: string
	}
}

const DEFAULT_MODEL = "gpt-5.5"
const DEFAULT_ONE_SHOT_TIMEOUT_MS = 45_000

function nowIso(): string {
	return new Date().toISOString()
}

function runtimeModeToThreadConfig(runtimeMode: AgentRuntimeMode): {
	approvalPolicy: string
	sandbox: string
	sandboxPolicy: { type: string }
} {
	switch (runtimeMode) {
		case "approval-required":
			return {
				approvalPolicy: "untrusted",
				sandbox: "read-only",
				sandboxPolicy: { type: "readOnly" }
			}
		case "auto-accept-edits":
			return {
				approvalPolicy: "on-request",
				sandbox: "workspace-write",
				sandboxPolicy: { type: "workspaceWrite" }
			}
		case "full-access":
			return {
				approvalPolicy: "never",
				sandbox: "danger-full-access",
				sandboxPolicy: { type: "dangerFullAccess" }
			}
	}
}

function buildInitializeParams(): Record<string, unknown> {
	return {
		clientInfo: {
			name: "beaver_hacks_desktop",
			title: "Beaver Hacks Desktop",
			version: "1.0.0"
		},
		capabilities: {
			experimentalApi: true
		}
	}
}

function readPath(payload: unknown, path: string[]): unknown {
	let cursor = payload as Record<string, unknown> | undefined | null
	for (const segment of path) {
		cursor = cursor?.[segment] as Record<string, unknown> | undefined | null
	}
	return cursor
}

function readText(value: unknown): string | undefined {
	return value === undefined || value === null ? undefined : String(value)
}

export class CodexAdapter implements ProviderAdapter {
	private readonly events = new EventEmitter()
	private readonly rpc: CodexJsonRpc
	private readonly threads = new Map<string, CodexThreadState>()
	private initializePromise: Promise<void> | null = null

	constructor(options: { cwd: string; command?: string; env?: NodeJS.ProcessEnv }) {
		this.rpc = new CodexJsonRpc({
			command: options.command ?? process.env.CODEX_BIN ?? "codex",
			cwd: options.cwd,
			env: options.env
		})

		this.rpc.on("notification", (message: CodexWireMessage) => this.handleNotification(message))
		this.rpc.on("request", (message: CodexWireMessage) => {
			if (message.id !== undefined) {
				this.rpc.respondError(message.id, `Unhandled Codex app-server request: ${message.method}`)
			}
		})
		this.rpc.on("stderr", (chunk: string) => {
			const line = chunk.trim()
			if (line) this.emitRuntimeError(this.activeThreadId(), line)
		})
		this.rpc.on("exit", () => {
			for (const thread of this.threads.values()) {
				this.setSession(thread.appThreadId, {
					...thread.session,
					status: "stopped",
					activeTurnId: null,
					updatedAt: nowIso()
				})
			}
		})
	}

	async startSession(input: ProviderSessionStartInput): Promise<AgentSession> {
		const existing = this.threads.get(input.threadId)
		if (existing) return existing.session

		this.emit({
			type: "session.state.changed",
			threadId: input.threadId,
			createdAt: nowIso(),
			payload: { status: "starting", reason: "Starting Codex app-server." }
		})

		await this.ensureInitialized()

		const config = runtimeModeToThreadConfig(input.runtimeMode)
		const opened = (await this.rpc.request("thread/start", {
			cwd: input.cwd,
			approvalPolicy: config.approvalPolicy,
			sandbox: config.sandbox,
			model: input.model ?? DEFAULT_MODEL
		})) as CodexThreadStartResponse

		const providerThreadId = String(opened.thread.id)
		const session: AgentSession = {
			status: "ready",
			provider: "codex",
			activeTurnId: null,
			lastError: null,
			updatedAt: nowIso()
		}

		this.threads.set(input.threadId, {
			appThreadId: input.threadId,
			providerThreadId,
			cwd: opened.cwd ?? input.cwd,
			model: opened.model ?? input.model ?? DEFAULT_MODEL,
			runtimeMode: input.runtimeMode,
			session
		})

		this.emit({
			type: "session.state.changed",
			threadId: input.threadId,
			createdAt: session.updatedAt,
			payload: { status: "ready", reason: "Codex session ready." }
		})

		return session
	}

	async sendTurn(input: ProviderSendTurnInput): Promise<ProviderTurnStartResult> {
		const thread = this.threads.get(input.threadId)
		if (!thread) throw new Error(`Codex session not started for thread ${input.threadId}`)

		const config = runtimeModeToThreadConfig(thread.runtimeMode)
		const response = (await this.rpc.request("turn/start", {
			threadId: thread.providerThreadId,
			input: [{ type: "text", text: input.prompt }],
			approvalPolicy: config.approvalPolicy,
			sandboxPolicy: config.sandboxPolicy,
			model: input.model ?? thread.model ?? DEFAULT_MODEL
		})) as CodexTurnStartResponse

		const turnId = String(response.turn.id)
		this.setSession(input.threadId, {
			...thread.session,
			status: "running",
			activeTurnId: turnId,
			updatedAt: nowIso()
		})

		return {
			threadId: input.threadId,
			turnId,
			resumeCursor: { threadId: thread.providerThreadId }
		}
	}

	async stopSession(threadId: string): Promise<void> {
		const thread = this.threads.get(threadId)
		if (!thread) return

		this.threads.delete(threadId)
		this.setSession(threadId, {
			...thread.session,
			status: "stopped",
			activeTurnId: null,
			updatedAt: nowIso()
		})
	}

	async runOneShot(input: {
		cwd: string
		prompt: string
		model: string
		runtimeMode: AgentRuntimeMode
		timeoutMs?: number
	}): Promise<string> {
		const threadId = `internal:${generatedId("thread")}`
		let output = ""

		return new Promise<string>((resolve, reject) => {
			const cleanup = this.onEvent((event) => {
				if (event.threadId !== threadId) return

				if (event.type === "assistant.delta") {
					output += event.payload.delta
					return
				}

				if (event.type === "runtime.error") {
					cleanup()
					clearTimeout(timeout)
					void this.stopSession(threadId)
					reject(new Error(event.payload.message))
					return
				}

				if (event.type === "turn.completed") {
					cleanup()
					clearTimeout(timeout)
					void this.stopSession(threadId)
					if (event.payload.status === "failed") {
						reject(new Error(event.payload.error ?? "Codex one-shot turn failed"))
						return
					}
					resolve(output)
				}
			})

			const timeout = setTimeout(() => {
				cleanup()
				void this.stopSession(threadId)
				reject(new Error("Codex one-shot turn timed out"))
			}, input.timeoutMs ?? DEFAULT_ONE_SHOT_TIMEOUT_MS)

			void this.startSession({
				threadId,
				cwd: input.cwd,
				model: input.model,
				runtimeMode: input.runtimeMode
			})
				.then(() =>
					this.sendTurn({
						threadId,
						prompt: input.prompt,
						model: input.model
					})
				)
				.catch((error: unknown) => {
					cleanup()
					clearTimeout(timeout)
					void this.stopSession(threadId)
					reject(error instanceof Error ? error : new Error(String(error)))
				})
		})
	}

	onEvent(listener: (event: ProviderRuntimeEvent) => void): () => void {
		this.events.on("event", listener)
		return () => this.events.off("event", listener)
	}

	private handleNotification(message: CodexWireMessage): void {
		const method = message.method
		const params = message.params
		const providerThreadId = readText(
			readPath(params, ["thread", "id"]) ??
				readPath(params, ["threadId"]) ??
				readPath(params, ["turn", "threadId"])
		)
		const appThreadId = this.appThreadIdForProviderThread(providerThreadId) ?? this.activeThreadId()
		if (!method || !appThreadId) return

		const turnId =
			readText(readPath(params, ["turn", "id"]) ?? readPath(params, ["turnId"])) ?? null
		const itemId =
			readText(readPath(params, ["item", "id"]) ?? readPath(params, ["itemId"])) ?? null
		const createdAt = nowIso()

		if (method === "turn/started" && turnId) {
			this.emit({ type: "turn.started", threadId: appThreadId, turnId, createdAt, payload: {} })
			return
		}

		if (method === "turn/completed") {
			const status = readText(readPath(params, ["turn", "status"])) ?? "completed"
			const error = readText(readPath(params, ["turn", "error", "message"]))
			this.emit({
				type: "turn.completed",
				threadId: appThreadId,
				turnId,
				createdAt,
				payload: {
					status:
						status === "failed" ||
						status === "cancelled" ||
						status === "interrupted" ||
						status === "completed"
							? status
							: "completed",
					...(error ? { error } : {})
				}
			})
			return
		}

		if (method === "item/agentMessage/delta") {
			const delta = readText(readPath(params, ["delta"]) ?? readPath(params, ["textDelta"]))
			if (!delta) return
			this.emit({
				type: "assistant.delta",
				threadId: appThreadId,
				turnId,
				itemId,
				createdAt,
				payload: { delta }
			})
			return
		}

		if (method === "item/started" || method === "item/completed") {
			const rawType = readText(readPath(params, ["item", "type"])) ?? "item"
			const title = readText(readPath(params, ["item", "title"]))
			this.emit({
				type: "activity",
				threadId: appThreadId,
				turnId,
				createdAt,
				payload: {
					kind: method,
					summary: title ?? rawType,
					detail: params
				}
			})
		}
	}

	private emit(event: ProviderRuntimeEvent): void {
		this.events.emit("event", event)
	}

	private ensureInitialized(): Promise<void> {
		this.initializePromise ??= this.rpc
			.request("initialize", buildInitializeParams())
			.then(() => this.rpc.notify("initialized"))
		return this.initializePromise
	}

	private setSession(threadId: string, session: AgentSession): void {
		const thread = this.threads.get(threadId)
		if (thread) {
			thread.session = session
		}
		this.emit({
			type: "session.state.changed",
			threadId,
			createdAt: session.updatedAt,
			payload: { status: session.status, reason: session.lastError ?? undefined }
		})
	}

	private emitRuntimeError(threadId: string | null, message: string): void {
		if (!threadId) return
		this.emit({
			type: "runtime.error",
			threadId,
			turnId: null,
			createdAt: nowIso(),
			payload: { message }
		})
	}

	private activeThreadId(): string | null {
		return Array.from(this.threads.keys()).at(-1) ?? null
	}

	private appThreadIdForProviderThread(providerThreadId: string | undefined): string | null {
		if (!providerThreadId) return null
		for (const thread of this.threads.values()) {
			if (thread.providerThreadId === providerThreadId) return thread.appThreadId
		}
		return null
	}
}

export function assistantMessageId(turnId: string | null, itemId: string | null): string {
	return `assistant:${itemId ?? turnId ?? generatedId("message")}`
}
