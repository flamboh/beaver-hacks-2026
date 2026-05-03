import { EventEmitter } from "node:events"
import { randomUUID } from "node:crypto"
import { ClaudeAdapter } from "./claudeAdapter"
import { CodexAdapter } from "./codexAdapter"
import { assistantMessageId } from "./runtimeIds"
import {
	buildAgentNamePrompt,
	parseAgentName,
	type GenerateAgentNameInput,
	type GenerateAgentNameResult
} from "./agentNaming"
import { recommendProjectSkills } from "../skills/skillRecommender"
import { installProjectSkill } from "../skills/skillInstaller"
import { listInstalledSkillKeys, matchesInstalledSkill } from "../skills/installedSkills"
import type {
	AgentActivity,
	AgentMessage,
	AgentPlan,
	AgentProvider,
	AgentRuntimeMode,
	AgentSession,
	AgentSnapshot,
	AgentThread,
	ProviderRuntimeEvent,
	FindSkillsInput,
	InstallSkillInput,
	ProviderAdapter,
	StartTurnInput
} from "./contracts"

const AGENT_NAME_MODEL = "gpt-5.4-mini"

function nowIso(): string {
	return new Date().toISOString()
}

function emptyPlan(): AgentPlan {
	return {
		items: [],
		source: null,
		updatedAt: null
	}
}

function providerForThread(thread: AgentThread): AgentProvider {
	return thread.provider
}

function newMessage(input: {
	role: AgentMessage["role"]
	text: string
	turnId?: string | null
	streaming?: boolean
}): AgentMessage {
	const createdAt = nowIso()
	return {
		id: `${input.role}:${randomUUID()}`,
		role: input.role,
		text: input.text,
		streaming: input.streaming ?? false,
		turnId: input.turnId ?? null,
		createdAt,
		updatedAt: createdAt
	}
}

export class AgentEngine {
	private readonly events = new EventEmitter()
	private readonly codexProvider: CodexAdapter
	private readonly providers: Record<AgentProvider, ProviderAdapter>
	private threads = new Map<string, AgentThread>()
	private activeThreadId: string | null = null

	constructor(options: { cwd: string }) {
		this.codexProvider = new CodexAdapter({ cwd: options.cwd })
		this.providers = {
			codex: this.codexProvider,
			claude: new ClaudeAdapter()
		}
		for (const provider of Object.values(this.providers)) {
			provider.onEvent((event) => this.ingestProviderEvent(event))
		}
	}

	getSnapshot(): AgentSnapshot {
		return {
			threads: Array.from(this.threads.values()),
			activeThreadId: this.activeThreadId,
			updatedAt: nowIso()
		}
	}

	onSnapshot(listener: (snapshot: AgentSnapshot) => void): () => void {
		this.events.on("snapshot", listener)
		return () => this.events.off("snapshot", listener)
	}

	async startTurn(input: StartTurnInput): Promise<AgentSnapshot> {
		const thread = this.ensureThread(input)
		const userMessage = newMessage({ role: "user", text: input.prompt })
		thread.messages.push(userMessage)
		thread.updatedAt = userMessage.createdAt
		this.activeThreadId = thread.id
		this.emitSnapshot()

		try {
			const provider = this.providers[providerForThread(thread)]
			const session = await provider.startSession({
				threadId: thread.id,
				cwd: thread.cwd,
				provider: providerForThread(thread),
				...(input.model ? { model: input.model } : {}),
				runtimeMode: input.runtimeMode ?? thread.runtimeMode
			})
			this.setThreadSession(thread.id, session)

			await provider.sendTurn({
				threadId: thread.id,
				prompt: input.prompt,
				...(input.model ? { model: input.model } : {})
			})
		} catch (error) {
			this.setThreadSession(thread.id, {
				status: "error",
				provider: providerForThread(thread),
				activeTurnId: null,
				lastError: error instanceof Error ? error.message : String(error),
				updatedAt: nowIso()
			})
		}

		this.emitSnapshot()
		return this.getSnapshot()
	}

	async findSkills(input: FindSkillsInput): Promise<AgentSnapshot> {
		const thread = this.ensureThread({
			threadId: input.threadId,
			cwd: input.cwd,
			prompt: input.prompt ?? "Find relevant skills for this project.",
			runtimeMode: input.runtimeMode
		})
		this.activeThreadId = thread.id
		this.emitSnapshot()

		try {
			await this.updateSkillSuggestions(thread, input.prompt ?? thread.title)
		} catch (error) {
			thread.activities.push({
				id: `activity:${randomUUID()}`,
				kind: "skills.error",
				summary: error instanceof Error ? error.message : String(error),
				payload: {},
				turnId: null,
				createdAt: nowIso()
			})
		}

		this.emitSnapshot()
		return this.getSnapshot()
	}

	async installSkill(input: InstallSkillInput): Promise<AgentSnapshot> {
		const thread = this.threads.get(input.threadId)
		if (!thread) throw new Error(`Thread not found: ${input.threadId}`)

		const skill = thread.suggestedSkills.find((suggestion) => suggestion.id === input.skillId)
		if (!skill?.installUrl) throw new Error(`Skill install target not found: ${input.skillId}`)

		await installProjectSkill(thread.cwd, skill.installUrl)
		const installedKeys = await listInstalledSkillKeys(thread.cwd)
		thread.suggestedSkills = thread.suggestedSkills.map((suggestion) => ({
			...suggestion,
			installed: matchesInstalledSkill(installedKeys, suggestion)
		}))
		thread.activities.push({
			id: `activity:${randomUUID()}`,
			kind: "skills.installed",
			summary: `Installed ${skill.installUrl} for this project.`,
			payload: { skillId: skill.id, installUrl: skill.installUrl },
			turnId: null,
			createdAt: nowIso()
		})
		thread.updatedAt = nowIso()
		this.emitSnapshot()
		return this.getSnapshot()
	}

	runOneShot(input: {
		cwd: string
		prompt: string
		model: string
		runtimeMode: AgentRuntimeMode
		timeoutMs?: number
	}): Promise<string> {
		return this.codexProvider.runOneShot(input)
	}

	async generateAgentName(input: GenerateAgentNameInput): Promise<GenerateAgentNameResult> {
		const raw = await this.runOneShot({
			cwd: input.cwd,
			prompt: buildAgentNamePrompt(input.prompt),
			model: AGENT_NAME_MODEL,
			runtimeMode: "approval-required",
			timeoutMs: 45_000
		})
		return { name: parseAgentName(raw) }
	}

	private ensureThread(input: StartTurnInput): AgentThread {
		const requestedThread = input.threadId ? this.threads.get(input.threadId) : undefined
		if (requestedThread) return requestedThread

		const createdAt = nowIso()
		const thread: AgentThread = {
			id: input.threadId ?? `thread:${randomUUID()}`,
			title: input.prompt.trim().slice(0, 80) || "New thread",
			cwd: input.cwd ?? process.cwd(),
			provider: input.provider ?? "codex",
			model: input.model ?? null,
			runtimeMode: input.runtimeMode ?? "full-access",
			messages: [],
			activities: [],
			plan: emptyPlan(),
			suggestedSkills: [],
			session: null,
			createdAt,
			updatedAt: createdAt
		}
		this.threads.set(thread.id, thread)
		return thread
	}

	private ingestProviderEvent(event: ProviderRuntimeEvent): void {
		const thread = this.threads.get(event.threadId)
		if (!thread) return

		switch (event.type) {
			case "session.state.changed":
				this.setThreadSession(event.threadId, {
					status: event.payload.status,
					provider: providerForThread(thread),
					activeTurnId: thread.session?.activeTurnId ?? null,
					lastError:
						event.payload.status === "error" ? (event.payload.reason ?? "Codex error") : null,
					updatedAt: event.createdAt
				})
				break

			case "turn.started":
				this.setThreadSession(event.threadId, {
					status: "running",
					provider: providerForThread(thread),
					activeTurnId: event.turnId,
					lastError: null,
					updatedAt: event.createdAt
				})
				break

			case "assistant.delta": {
				const messageId = assistantMessageId(event.turnId, event.itemId)
				const existing = thread.messages.find((message) => message.id === messageId)
				if (existing) {
					existing.text += event.payload.delta
					existing.updatedAt = event.createdAt
				} else {
					thread.messages.push({
						id: messageId,
						role: "assistant",
						text: event.payload.delta,
						streaming: true,
						turnId: event.turnId,
						createdAt: event.createdAt,
						updatedAt: event.createdAt
					})
				}
				break
			}

			case "turn.completed":
				for (const message of thread.messages) {
					if (message.role === "assistant" && message.turnId === event.turnId) {
						message.streaming = false
						message.updatedAt = event.createdAt
					}
				}
				this.setThreadSession(event.threadId, {
					status: event.payload.status === "failed" ? "error" : "ready",
					provider: providerForThread(thread),
					activeTurnId: null,
					lastError: event.payload.error ?? null,
					updatedAt: event.createdAt
				})
				break

			case "activity":
				thread.activities.push(this.toActivity(event))
				break

			case "plan.updated":
				thread.plan = event.payload.plan
				break

			case "runtime.error":
				thread.activities.push(this.toActivity(event))
				break
		}

		thread.updatedAt = event.createdAt
		this.emitSnapshot()
	}

	private toActivity(
		event: Extract<ProviderRuntimeEvent, { type: "activity" | "runtime.error" }>
	): AgentActivity {
		if (event.type === "runtime.error") {
			return {
				id: `activity:${randomUUID()}`,
				kind: "runtime.error",
				summary: event.payload.message,
				payload: event.payload,
				turnId: event.turnId,
				createdAt: event.createdAt
			}
		}

		return {
			id: `activity:${randomUUID()}`,
			kind: event.payload.kind,
			summary: event.payload.summary,
			payload: event.payload.detail ?? {},
			turnId: event.turnId,
			createdAt: event.createdAt
		}
	}

	private setThreadSession(threadId: string, session: AgentSession): void {
		const thread = this.threads.get(threadId)
		if (!thread) return
		thread.session = session
		thread.updatedAt = session.updatedAt
	}

	private async updateSkillSuggestions(thread: AgentThread, prompt: string): Promise<void> {
		const recommendation = await recommendProjectSkills(thread.cwd, prompt, {
			runCodexPrompt: (input) =>
				this.codexProvider.runOneShot({
					cwd: thread.cwd,
					prompt: input.prompt,
					model: input.model,
					runtimeMode: thread.runtimeMode
				})
		})
		thread.suggestedSkills = recommendation.suggestions
		thread.activities.push({
			id: `activity:${randomUUID()}`,
			kind: "skills.suggested",
			summary: recommendation.marketplaceError
				? recommendation.marketplaceError
				: recommendation.suggestions.length > 0
					? `Suggested ${recommendation.suggestions.length} skills from ${recommendation.profile.source} project profile.`
					: `No skills suggested from ${recommendation.profile.source} project profile.`,
			payload: recommendation,
			turnId: null,
			createdAt: nowIso()
		})
		this.emitSnapshot()
	}

	private emitSnapshot(): void {
		this.events.emit("snapshot", this.getSnapshot())
	}
}
