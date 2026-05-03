import { EventEmitter } from "node:events"
import { randomUUID } from "node:crypto"
import {
	query,
	type Options as ClaudeOptions,
	type Query,
	type SDKMessage,
	type SDKPartialAssistantMessage,
	type SDKUserMessage
} from "@anthropic-ai/claude-agent-sdk"
import { ClaudePromptQueue } from "./claudePromptQueue"
import type {
	AgentPlan,
	AgentPlanItemStatus,
	AgentRuntimeMode,
	AgentSession,
	ProviderAdapter,
	ProviderRuntimeEvent,
	ProviderSendTurnInput,
	ProviderSessionStartInput,
	ProviderTurnStartResult
} from "./contracts"

interface ClaudeThreadState {
	appThreadId: string
	cwd: string
	model: string | null
	runtimeMode: AgentRuntimeMode
	session: AgentSession
	query: Query
	abortController: AbortController
	queue: ClaudePromptQueue
	currentTurnId: string | null
	sessionId: string | null
	emittedPartialText: boolean
}

const DEFAULT_MODEL = "claude-sonnet-4-6"

function nowIso(): string {
	return new Date().toISOString()
}

function runtimeModeToClaudeOptions(
	runtimeMode: AgentRuntimeMode
): Pick<ClaudeOptions, "allowDangerouslySkipPermissions" | "permissionMode"> {
	switch (runtimeMode) {
		case "full-access":
			return {
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true
			}
		case "auto-accept-edits":
			return { permissionMode: "acceptEdits" }
		case "approval-required":
			return { permissionMode: "default" }
	}
}

function messageText(message: SDKMessage): string {
	if (message.type !== "assistant") return ""

	const content = message.message.content
	if (!Array.isArray(content)) return ""

	return content
		.map((block) => {
			if (!(block instanceof Object)) return ""
			if (!("type" in block) || block.type !== "text") return ""
			return "text" in block && block.text ? String(block.text) : ""
		})
		.join("")
}

function toolUseSummaries(message: SDKMessage): string[] {
	if (message.type !== "assistant") return []

	const content = message.message.content
	if (!Array.isArray(content)) return []

	return content.flatMap((block) => {
		if (!(block instanceof Object)) return []
		if (!("type" in block) || block.type !== "tool_use") return []
		const name = "name" in block ? String(block.name) : "tool"
		return [`Claude used ${name}`]
	})
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

function todoStatus(value: unknown): AgentPlanItemStatus {
	const status = readText(value)
	if (status === "in_progress") return "in_progress"
	if (status === "completed") return "completed"
	if (status === "cancelled") return "cancelled"
	return "pending"
}

function planFromClaudeToolUse(message: SDKMessage, createdAt: string): AgentPlan | null {
	if (message.type !== "assistant") return null
	const content = message.message.content
	if (!Array.isArray(content)) return null

	for (const block of content) {
		if (!(block instanceof Object)) continue
		if (!("type" in block) || block.type !== "tool_use") continue
		if (!("name" in block) || String(block.name) !== "TodoWrite") continue
		const todos = readPath(block, ["input", "todos"])
		if (!Array.isArray(todos)) return null
		return {
			items: todos.map((todo, index) => ({
				id: readText(readPath(todo, ["id"])) ?? `claude-plan-item:${index}`,
				title:
					readText(readPath(todo, ["content"]) ?? readPath(todo, ["title"]))?.trim() ||
					`Plan item ${index + 1}`,
				status: todoStatus(readPath(todo, ["status"])),
				detail: readText(readPath(todo, ["activeForm"]) ?? readPath(todo, ["detail"])) ?? null,
				updatedAt: createdAt
			})),
			source: "claude",
			updatedAt: createdAt
		}
	}

	return null
}

function partialText(message: SDKPartialAssistantMessage): string {
	const event = message.event
	if (!(event instanceof Object)) return ""
	if (!("type" in event) || event.type !== "content_block_delta") return ""
	if (!("delta" in event) || !(event.delta instanceof Object)) return ""
	const delta = event.delta
	if (!("type" in delta) || delta.type !== "text_delta") return ""
	return "text" in delta && delta.text ? String(delta.text) : ""
}

function claudeUserMessage(prompt: string): SDKUserMessage {
	return {
		type: "user",
		message: {
			role: "user",
			content: prompt
		},
		parent_tool_use_id: null
	}
}

export class ClaudeAdapter implements ProviderAdapter {
	private readonly events = new EventEmitter()
	private readonly threads = new Map<string, ClaudeThreadState>()

	constructor(private readonly options: { env?: NodeJS.ProcessEnv } = {}) {}

	async startSession(input: ProviderSessionStartInput): Promise<AgentSession> {
		const existing = this.threads.get(input.threadId)
		if (existing) return existing.session

		this.emit({
			type: "session.state.changed",
			threadId: input.threadId,
			createdAt: nowIso(),
			payload: { status: "starting", reason: "Starting Claude session." }
		})

		const abortController = new AbortController()
		const promptQueue = new ClaudePromptQueue()
		const runtimeOptions = runtimeModeToClaudeOptions(input.runtimeMode)
		const claudeQuery = query({
			prompt: promptQueue,
			options: {
				abortController,
				cwd: input.cwd,
				model: input.model ?? DEFAULT_MODEL,
				env: this.options.env ?? process.env,
				includePartialMessages: true,
				...runtimeOptions
			}
		})

		const session: AgentSession = {
			status: "ready",
			provider: "claude",
			model: input.model ?? DEFAULT_MODEL,
			activeTurnId: null,
			lastError: null,
			updatedAt: nowIso()
		}

		const thread: ClaudeThreadState = {
			appThreadId: input.threadId,
			cwd: input.cwd,
			model: input.model ?? DEFAULT_MODEL,
			runtimeMode: input.runtimeMode,
			session,
			query: claudeQuery,
			abortController,
			queue: promptQueue,
			currentTurnId: null,
			sessionId: null,
			emittedPartialText: false
		}

		this.threads.set(input.threadId, thread)
		void this.consume(thread)

		this.emit({
			type: "session.state.changed",
			threadId: input.threadId,
			createdAt: session.updatedAt,
			payload: { status: "ready", reason: "Claude session ready.", model: session.model }
		})

		return session
	}

	async sendTurn(input: ProviderSendTurnInput): Promise<ProviderTurnStartResult> {
		const thread = this.threads.get(input.threadId)
		if (!thread) throw new Error(`Claude session not started for thread ${input.threadId}`)

		if (input.model && input.model !== thread.model) {
			await thread.query.setModel(input.model)
			thread.model = input.model
		}

		const turnId = `turn:${randomUUID()}`
		thread.currentTurnId = turnId
		thread.emittedPartialText = false
		thread.queue.push(claudeUserMessage(input.prompt))
		this.setSession(input.threadId, {
			...thread.session,
			status: "running",
			model: thread.model,
			activeTurnId: turnId,
			updatedAt: nowIso()
		})
		this.emit({
			type: "turn.started",
			threadId: input.threadId,
			turnId,
			createdAt: nowIso(),
			payload: {}
		})

		return {
			threadId: input.threadId,
			turnId,
			resumeCursor: thread.sessionId ? { sessionId: thread.sessionId } : undefined
		}
	}

	async stopSession(threadId: string): Promise<void> {
		const thread = this.threads.get(threadId)
		if (!thread) return

		thread.queue.push(null)
		thread.abortController.abort()
		thread.query.close()
		this.threads.delete(threadId)
		this.setSession(threadId, {
			...thread.session,
			status: "stopped",
			model: thread.model,
			activeTurnId: null,
			updatedAt: nowIso()
		})
	}

	onEvent(listener: (event: ProviderRuntimeEvent) => void): () => void {
		this.events.on("event", listener)
		return () => this.events.off("event", listener)
	}

	private async consume(thread: ClaudeThreadState): Promise<void> {
		try {
			for await (const message of thread.query) {
				this.captureSessionId(thread, message)
				this.handleMessage(thread, message)
			}
		} catch (error) {
			if (!thread.abortController.signal.aborted) {
				this.failTurn(thread, error instanceof Error ? error.message : String(error))
			}
		}
	}

	private handleMessage(thread: ClaudeThreadState, message: SDKMessage): void {
		const turnId = thread.currentTurnId

		if (message.type === "stream_event") {
			const delta = partialText(message)
			if (!delta) return
			thread.emittedPartialText = true
			this.emit({
				type: "assistant.delta",
				threadId: thread.appThreadId,
				turnId,
				itemId: message.uuid,
				createdAt: nowIso(),
				payload: { delta }
			})
			return
		}

		if (message.type === "assistant") {
			const createdAt = nowIso()
			const plan = planFromClaudeToolUse(message, createdAt)
			if (plan) {
				this.emit({
					type: "plan.updated",
					threadId: thread.appThreadId,
					turnId,
					createdAt,
					payload: { plan }
				})
			}

			for (const summary of toolUseSummaries(message)) {
				this.emit({
					type: "activity",
					threadId: thread.appThreadId,
					turnId,
					createdAt,
					payload: { kind: "tool.use", summary, detail: message.message.content }
				})
			}

			if (thread.emittedPartialText) return
			const text = messageText(message)
			if (!text) return
			this.emit({
				type: "assistant.delta",
				threadId: thread.appThreadId,
				turnId,
				itemId: message.uuid,
				createdAt: nowIso(),
				payload: { delta: text }
			})
			return
		}

		if (message.type === "result") {
			const status = message.subtype === "success" && !message.is_error ? "completed" : "failed"
			const error =
				message.subtype === "success" ? undefined : message.errors.join("\n") || message.subtype
			this.emit({
				type: "turn.completed",
				threadId: thread.appThreadId,
				turnId,
				createdAt: nowIso(),
				payload: { status, ...(error ? { error } : {}) }
			})
			this.setSession(thread.appThreadId, {
				...thread.session,
				status: status === "failed" ? "error" : "ready",
				model: thread.model,
				activeTurnId: null,
				lastError: error ?? null,
				updatedAt: nowIso()
			})
			thread.currentTurnId = null
			return
		}

		if (message.type === "system" && "subtype" in message) {
			const subtype = String(message.subtype)
			if (
				subtype === "api_retry" ||
				subtype === "notification" ||
				subtype === "local_command_output"
			) {
				this.emit({
					type: "activity",
					threadId: thread.appThreadId,
					turnId,
					createdAt: nowIso(),
					payload: { kind: `claude.${subtype}`, summary: subtype, detail: message }
				})
			}
		}
	}

	private captureSessionId(thread: ClaudeThreadState, message: SDKMessage): void {
		if (!("session_id" in message)) return
		const sessionId = message.session_id
		if (!sessionId) return
		thread.sessionId = String(sessionId)
	}

	private failTurn(thread: ClaudeThreadState, message: string): void {
		this.emit({
			type: "runtime.error",
			threadId: thread.appThreadId,
			turnId: thread.currentTurnId,
			createdAt: nowIso(),
			payload: { message }
		})
		this.emit({
			type: "turn.completed",
			threadId: thread.appThreadId,
			turnId: thread.currentTurnId,
			createdAt: nowIso(),
			payload: { status: "failed", error: message }
		})
		this.setSession(thread.appThreadId, {
			...thread.session,
			status: "error",
			model: thread.model,
			activeTurnId: null,
			lastError: message,
			updatedAt: nowIso()
		})
		thread.currentTurnId = null
	}

	private setSession(threadId: string, session: AgentSession): void {
		const thread = this.threads.get(threadId)
		if (thread) thread.session = session
		this.emit({
			type: "session.state.changed",
			threadId,
			createdAt: session.updatedAt,
			payload: {
				status: session.status,
				reason: session.lastError ?? undefined,
				model: session.model
			}
		})
	}

	private emit(event: ProviderRuntimeEvent): void {
		this.events.emit("event", event)
	}
}
