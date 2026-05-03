import { EventEmitter } from "node:events"
import { randomUUID } from "node:crypto"
import { ClaudeAdapter } from "./claudeAdapter"
import { CodexAdapter } from "./codexAdapter"
import { assistantMessageId } from "./runtimeIds"
import { checkSemgrepAvailability, runSemgrepScan, semgrepSummaryForPrompt } from "./semgrep"
import {
	buildAgentNamePrompt,
	parseAgentName,
	type GenerateAgentNameInput,
	type GenerateAgentNameResult
} from "./agentNaming"
import { recommendProjectSkills } from "../skills/skillRecommender"
import { installProjectSkill } from "../skills/skillInstaller"
import {
	listInstalledSkillKeys,
	matchesInstalledSkill,
	removeInstalledSkill
} from "../skills/installedSkills"
import { recommendProjectMcps } from "../mcp/mcpRecommender"
import type {
	AgentActivity,
	AgentModelOption,
	AgentMessage,
	AgentPlan,
	AgentProvider,
	SemgrepStatus,
	ProviderAdapter,
	AgentRuntimeMode,
	AgentSession,
	AgentSnapshot,
	AgentThread,
	ProviderRuntimeEvent,
	FindSkillsInput,
	FindMcpsInput,
	InstallSkillInput,
	SpawnThreadInput,
	StopTurnInput,
	StartTurnInput,
	UninstallSkillInput
} from "./contracts"

const AGENT_NAME_MODEL = "gpt-5.4-mini"

interface AgentPlanSink {
	syncPlan(agentId: string, turnId: string | null, plan: AgentPlan): Promise<void>
}

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

function agentIdForThread(threadId: string): string | null {
	if (threadId.startsWith("agent:")) return threadId
	if (!threadId.startsWith("thread:agent:")) return null
	return threadId.slice("thread:".length)
}

function planningToolForProvider(provider: AgentProvider): "update_plan" | "TodoWrite" {
	return provider === "claude" ? "TodoWrite" : "update_plan"
}

function promptForTurn(input: {
	provider: AgentProvider
	prompt: string
	planningMode: boolean
	securityMode: boolean
	semgrepSummary: string | null
}): string {
	if (!input.planningMode && !input.securityMode) return input.prompt

	const lines: string[] = []
	if (input.planningMode) {
		const planningTool = planningToolForProvider(input.provider)
		lines.push(
			"Planning mode is enabled for this turn.",
			`Before doing anything else, your first tool call must be ${planningTool}.`,
			"This turn is plan-only.",
			"Do not modify files, do not run write operations, and do not apply patches.",
			"Lay out a concrete task list and stop after planning.",
			"Plan-only rules:",
			"- Include clear actionable tasks.",
			"- Mark exactly one task as in_progress.",
			"- Leave remaining tasks as pending unless already completed.",
			"If you cannot call the planning tool, stop and explain why."
		)
	}

	if (input.securityMode) {
		lines.push(
			"Security mode is enabled for this turn.",
			"Semgrep has already been run and must be accounted for without exception.",
			"Review findings first. If planning mode is enabled, include remediation tasks only and do not implement in this turn.",
			"Semgrep summary:",
			input.semgrepSummary ?? "Semgrep summary unavailable."
		)
	}

	lines.push("", "User request:", input.prompt)
	return lines.join("\n")
}

function runtimeModeForTurn(input: StartTurnInput): AgentRuntimeMode {
	if (input.planningMode) return "approval-required"
	return input.runtimeMode ?? "full-access"
}

function turnPolicyKey(threadId: string, turnId: string): string {
	return `${threadId}:${turnId}`
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
	private planSink: AgentPlanSink | null = null
	private threads = new Map<string, AgentThread>()
	private planningOnlyTurns = new Set<string>()
	private planningTurnRequests = new Set<string>()
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

	setPlanSink(sink: AgentPlanSink): void {
		this.planSink = sink
	}

	async listModels(provider: AgentProvider): Promise<AgentModelOption[]> {
		return this.providers[provider].listModels?.() ?? []
	}

	async getSemgrepStatus(): Promise<SemgrepStatus> {
		return checkSemgrepAvailability()
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
			const turnRuntimeMode = runtimeModeForTurn(input)
			if (thread.runtimeMode !== turnRuntimeMode) {
				await provider.stopSession(thread.id)
				thread.session = null
				thread.runtimeMode = turnRuntimeMode
			}
			let semgrepSummary: string | null = null
			if (input.securityMode) {
				thread.activities.push({
					id: `activity:${randomUUID()}`,
					kind: "security.scan.started",
					summary: "Running Semgrep security scan.",
					payload: {},
					turnId: null,
					createdAt: nowIso()
				})
				this.emitSnapshot()
				const semgrep = await runSemgrepScan(thread.cwd)
				semgrepSummary = semgrepSummaryForPrompt(semgrep)
				thread.activities.push({
					id: `activity:${randomUUID()}`,
					kind: "security.scan.completed",
					summary:
						semgrep.findingCount > 0
							? `Semgrep found ${semgrep.findingCount} issue${semgrep.findingCount === 1 ? "" : "s"}.`
							: "Semgrep found no issues.",
					payload: semgrep,
					turnId: null,
					createdAt: nowIso()
				})
				this.emitSnapshot()
			}
			const turnPrompt = promptForTurn({
				provider: providerForThread(thread),
				prompt: input.prompt,
				planningMode: input.planningMode ?? false,
				securityMode: input.securityMode ?? false,
				semgrepSummary
			})
			const session = await provider.startSession({
				threadId: thread.id,
				cwd: thread.cwd,
				provider: providerForThread(thread),
				...(input.model ? { model: input.model } : {}),
				runtimeMode: thread.runtimeMode
			})
			this.setThreadSession(thread.id, session)

			if (input.planningMode) this.planningTurnRequests.add(thread.id)
			const turn = await provider.sendTurn({
				threadId: thread.id,
				prompt: turnPrompt,
				...(input.model ? { model: input.model } : {}),
				...(input.effort ? { effort: input.effort } : {}),
				...(input.speedTier ? { speedTier: input.speedTier } : {})
			})
			if (input.planningMode) {
				this.planningTurnRequests.delete(thread.id)
				this.planningOnlyTurns.add(turnPolicyKey(thread.id, turn.turnId))
			}
		} catch (error) {
			this.planningTurnRequests.delete(thread.id)
			this.setThreadSession(thread.id, {
				status: "error",
				provider: providerForThread(thread),
				model: thread.session?.model ?? thread.model,
				activeTurnId: null,
				lastError: error instanceof Error ? error.message : String(error),
				updatedAt: nowIso()
			})
		}

		this.emitSnapshot()
		return this.getSnapshot()
	}

	async stopTurn(input: StopTurnInput): Promise<AgentSnapshot> {
		const thread = this.threads.get(input.threadId)
		if (!thread) return this.getSnapshot()

		const activeTurnId = thread.session?.activeTurnId ?? null
		await this.providers[providerForThread(thread)].stopSession(thread.id)
		for (const message of thread.messages) {
			if (message.role === "assistant" && (!activeTurnId || message.turnId === activeTurnId)) {
				message.streaming = false
				message.updatedAt = nowIso()
			}
		}
		thread.activities.push({
			id: `activity:${randomUUID()}`,
			kind: "turn.cancelled",
			summary: "Agent turn cancelled.",
			payload: {},
			turnId: activeTurnId,
			createdAt: nowIso()
		})
		this.setThreadSession(thread.id, {
			status: "stopped",
			provider: providerForThread(thread),
			model: thread.session?.model ?? thread.model,
			activeTurnId: null,
			lastError: null,
			updatedAt: nowIso()
		})
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

	async findMcps(input: FindMcpsInput): Promise<AgentSnapshot> {
		const thread = this.ensureThread({
			threadId: input.threadId,
			cwd: input.cwd,
			prompt: input.prompt ?? "Find relevant MCP servers for this project.",
			runtimeMode: input.runtimeMode
		})
		this.activeThreadId = thread.id
		this.emitSnapshot()

		try {
			await this.updateMcpSuggestions(thread, input.prompt ?? thread.title)
		} catch (error) {
			thread.activities.push({
				id: `activity:${randomUUID()}`,
				kind: "mcps.error",
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

	async uninstallSkill(input: UninstallSkillInput): Promise<AgentSnapshot> {
		const thread = this.threads.get(input.threadId)
		const cwd = thread?.cwd ?? input.cwd

		await removeInstalledSkill(cwd, input.skillPath)
		if (thread) {
			const installedKeys = await listInstalledSkillKeys(cwd)
			thread.suggestedSkills = thread.suggestedSkills.map((suggestion) => ({
				...suggestion,
				installed: matchesInstalledSkill(installedKeys, suggestion)
			}))
			thread.activities.push({
				id: `activity:${randomUUID()}`,
				kind: "skills.uninstalled",
				summary: "Uninstalled skill from this project.",
				payload: { skillPath: input.skillPath },
				turnId: null,
				createdAt: nowIso()
			})
			thread.updatedAt = nowIso()
		}
		this.emitSnapshot()
		return this.getSnapshot()
	}

	spawnThread(input: SpawnThreadInput): AgentSnapshot {
		if (!this.threads.has(input.threadId)) {
			const createdAt = nowIso()
			const thread: AgentThread = {
				id: input.threadId,
				title: input.name ?? "Agent",
				cwd: input.cwd,
				provider: "codex",
				model: input.model ?? null,
				runtimeMode: "full-access",
				messages: [],
				activities: [],
				plan: emptyPlan(),
				suggestedSkills: [],
				suggestedMcps: [],
				session: null,
				createdAt,
				updatedAt: createdAt
			}
			this.threads.set(thread.id, thread)
			this.emitSnapshot()
		}
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
			suggestedMcps: [],
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
					model: event.payload.model ?? thread.session?.model ?? thread.model,
					activeTurnId: thread.session?.activeTurnId ?? null,
					lastError:
						event.payload.status === "error" ? (event.payload.reason ?? "Agent error") : null,
					updatedAt: event.createdAt
				})
				break

			case "turn.started":
				if (this.planningTurnRequests.has(event.threadId)) {
					this.planningOnlyTurns.add(turnPolicyKey(event.threadId, event.turnId))
					this.planningTurnRequests.delete(event.threadId)
				}
				this.setThreadSession(event.threadId, {
					status: "running",
					provider: providerForThread(thread),
					model: thread.session?.model ?? thread.model,
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
				if (event.turnId) {
					this.planningOnlyTurns.delete(turnPolicyKey(event.threadId, event.turnId))
				}
				for (const message of thread.messages) {
					if (message.role === "assistant" && message.turnId === event.turnId) {
						message.streaming = false
						message.updatedAt = event.createdAt
					}
				}
				this.setThreadSession(event.threadId, {
					status: event.payload.status === "failed" ? "error" : "ready",
					provider: providerForThread(thread),
					model: thread.session?.model ?? thread.model,
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
				this.syncPlanTasks(thread, event)
				this.stopPlanningModeTurn(thread, event.turnId, event.createdAt)
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
					? `Suggested ${recommendation.suggestions.length} skills relevant to your project.`
					: "No skills suggested for your project.",
			payload: recommendation,
			turnId: null,
			createdAt: nowIso()
		})
		this.emitSnapshot()
	}

	private async updateMcpSuggestions(thread: AgentThread, prompt: string): Promise<void> {
		const recommendation = await recommendProjectMcps(thread.cwd, prompt, {
			runCodexPrompt: (input) =>
				this.codexProvider.runOneShot({
					cwd: thread.cwd,
					prompt: input.prompt,
					model: input.model,
					runtimeMode: thread.runtimeMode
				})
		})
		thread.suggestedMcps = recommendation.suggestions
		thread.activities.push({
			id: `activity:${randomUUID()}`,
			kind: "mcps.suggested",
			summary: recommendation.searchError
				? recommendation.searchError
				: recommendation.suggestions.length > 0
					? `Suggested ${recommendation.suggestions.length} MCP servers from GitHub.`
					: "No MCP servers suggested from GitHub.",
			payload: recommendation,
			turnId: null,
			createdAt: nowIso()
		})
		this.emitSnapshot()
	}

	private emitSnapshot(): void {
		this.events.emit("snapshot", this.getSnapshot())
	}

	private syncPlanTasks(
		thread: AgentThread,
		event: Extract<ProviderRuntimeEvent, { type: "plan.updated" }>
	): void {
		const agentId = agentIdForThread(thread.id)
		if (!this.planSink || !agentId) return
		void this.planSink
			.syncPlan(agentId, event.turnId, event.payload.plan)
			.catch((error: unknown) => {
				thread.activities.push({
					id: `activity:${randomUUID()}`,
					kind: "task.sync.error",
					summary: error instanceof Error ? error.message : String(error),
					payload: {},
					turnId: event.turnId,
					createdAt: nowIso()
				})
				this.emitSnapshot()
			})
	}

	private stopPlanningModeTurn(
		thread: AgentThread,
		turnId: string | null,
		createdAt: string
	): void {
		const activeTurnId = turnId ?? thread.session?.activeTurnId
		if (!activeTurnId) return
		const key = turnPolicyKey(thread.id, activeTurnId)
		if (!this.planningOnlyTurns.delete(key)) return

		thread.activities.push({
			id: `activity:${randomUUID()}`,
			kind: "planning.mode.completed",
			summary: "Planning mode captured tasks and stopped before implementation.",
			payload: {},
			turnId: activeTurnId,
			createdAt
		})
		const provider = this.providers[providerForThread(thread)]
		void provider.stopSession(thread.id).catch((error: unknown) => {
			thread.activities.push({
				id: `activity:${randomUUID()}`,
				kind: "runtime.error",
				summary: error instanceof Error ? error.message : String(error),
				payload: {},
				turnId: activeTurnId,
				createdAt: nowIso()
			})
			this.emitSnapshot()
		})
	}
}
