import { type MouseEvent, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAgentSnapshot } from "@renderer/agentStore"
import { Chat } from "@renderer/components/chat"
import { ChevronDown } from "lucide-react"
import type { AgentRow } from "@renderer/types/models"
import AgentCardScopeModal from "./AgentCardScopeModal"
import AgentCardSideCreateButton, { type CreateSide } from "./AgentCardSideCreateButton"
import { parseScopePath } from "./agentCardScopePath"
import TaskList from "./TaskList"
import { CARD_H, CARD_W } from "./controlPanelLayout"
import { agentNameForPrompt, type StartAgentInput } from "./useControlPanelAgents"

export type { CreateSide }

const PRIORITY_LEVELS = ["low", "medium", "high"] as const
const MODEL_OPTIONS: { group: string; models: { value: string; label: string }[] }[] = [
	{
		group: "Anthropic",
		models: [
			{ value: "claude-opus-4-7", label: "Claude Opus 4.7" },
			{ value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
			{ value: "claude-haiku-4-5", label: "Claude Haiku 4.5" }
		]
	},
	{
		group: "OpenAI",
		models: [
			{ value: "gpt-5.5", label: "GPT-5.5" },
			{ value: "gpt-4o", label: "GPT-4o" },
			{ value: "gpt-4o-mini", label: "GPT-4o mini" },
			{ value: "o3", label: "o3" },
			{ value: "o4-mini", label: "o4-mini" }
		]
	}
]

const EFFORT_STYLES: Record<string, string> = {
	low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
	high: "bg-red-500/15 text-red-400 border-red-500/30"
}

interface Props {
	agent: AgentRow
	availableCreateSides: CreateSide[]
	isDeleting: boolean
	onCreateAgent: (input: StartAgentInput) => Promise<void>
	onDeleteAgent: (id: string) => Promise<void>
	workspaceId: string
	workspacePath: string
}

export default function AgentCard({
	agent,
	availableCreateSides,
	isDeleting,
	onCreateAgent,
	onDeleteAgent,
	workspaceId,
	workspacePath
}: Props) {
	const [activeCreateSide, setActiveCreateSide] = useState<CreateSide | null>(null)
	const [isEditingName, setIsEditingName] = useState(false)
	const [nameDraft, setNameDraft] = useState(agent.name)
	const [isSavingName, setIsSavingName] = useState(false)
	const [effort, setEffort] = useState(agent.effort)
	const [model, setModel] = useState(agent.model)
	const [scopePath, setScopePath] = useState(agent.scope_path)
	const [scopeModalOpen, setScopeModalOpen] = useState(false)
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const skipNameCommitRef = useRef(false)
	const queryClient = useQueryClient()
	const snapshot = useAgentSnapshot()
	const agentThreadId = agent.thread_id ?? `thread:${agent.id}`
	const thread = snapshot.threads.find((agentThread) => agentThread.id === agentThreadId) ?? null
	const session = thread?.session ?? null
	const runtimeModel = session?.model ?? null
	const isRunning =
		session !== null &&
		(session.status === "starting" || session.status === "running" || session.activeTurnId !== null)

	const scopeDisplay = parseScopePath(scopePath)
	const updateEffort = (nextEffort: string) => {
		setEffort(nextEffort)
		void window.api.agents
			.update({ id: agent.id, effort: nextEffort })
			.then((updatedAgent) => {
				setEffort(updatedAgent.effort)
				void queryClient.invalidateQueries({ queryKey: ["agents"] })
			})
			.catch(() => setEffort(agent.effort))
	}
	const updateModel = (nextModel: string) => {
		setModel(nextModel)
		void window.api.agents
			.update({ id: agent.id, model: nextModel })
			.then((updatedAgent) => {
				setModel(updatedAgent.model)
				void queryClient.invalidateQueries({ queryKey: ["agents"] })
			})
			.catch(() => setModel(agent.model))
	}
	const updateScope = async (nextScopePath: string) => {
		const updatedAgent = await window.api.agents.update({
			id: agent.id,
			scope_path: nextScopePath
		})
		setScopePath(updatedAgent.scope_path)
		await queryClient.invalidateQueries({ queryKey: ["agents"] })
	}
	const deleteAgent = () => {
		setDeleting(true)
		void onDeleteAgent(agent.id).finally(() => setDeleting(false))
	}
	const requestDelete = () => {
		if (deleteArmed) {
			deleteAgent()
			return
		}
		setDeleteArmed(true)
	}
	const clearSelectionOutsideText = (event: MouseEvent<HTMLDivElement>) => {
		const target = event.target as Element | null
		if (target?.closest("[data-selectable-text], input, textarea, select, button")) return
		window.getSelection()?.removeAllRanges()
	}

	async function handleFirstMessage(prompt: string): Promise<void> {
		await window.api.tasks.create({
			agent_id: agent.id,
			turn_id: null,
			status: "working",
			description: prompt
		})
		if (agent.name === "New Agent") {
			const seedName = agentNameForPrompt(prompt)
			await window.api.agents.update({
				id: agent.id,
				name: seedName,
				thread_id: agentThreadId
			})
			await queryClient.invalidateQueries({ queryKey: ["agents"] })
			void window.api.agent
				.generateName({ cwd: workspacePath, prompt })
				.then(async ({ name }) => {
					if (!name || name === seedName || name === "New Agent") return
					await window.api.agents.update({
						id: agent.id,
						name,
						thread_id: agentThreadId,
						expectedName: seedName
					})
					await queryClient.invalidateQueries({ queryKey: ["agents"] })
				})
				.catch(() => undefined)
		} else if (!agent.thread_id) {
			await window.api.agents.update({
				id: agent.id,
				thread_id: agentThreadId
			})
			await queryClient.invalidateQueries({ queryKey: ["agents"] })
		}
		await queryClient.invalidateQueries({ queryKey: ["tasks", agent.id] })
	}

	async function commitName(): Promise<void> {
		if (skipNameCommitRef.current) {
			skipNameCommitRef.current = false
			return
		}
		const nextName = nameDraft.trim()
		if (!nextName || nextName === agent.name) {
			setNameDraft(agent.name)
			setIsEditingName(false)
			return
		}
		setIsSavingName(true)
		try {
			await window.api.agents.update({ id: agent.id, name: nextName })
			await queryClient.invalidateQueries({ queryKey: ["agents"] })
			setIsEditingName(false)
		} finally {
			setIsSavingName(false)
		}
	}

	return (
		<div
			className="group/card nodrag relative cursor-default text-white"
			style={{ width: CARD_W, height: CARD_H }}
			onMouseDown={clearSelectionOutsideText}
			onWheel={(event) => event.stopPropagation()}
		>
			{availableCreateSides.map((side) => (
				<AgentCardSideCreateButton
					key={side}
					active={activeCreateSide === side}
					onClose={() => setActiveCreateSide(null)}
					onCreateAgent={onCreateAgent}
					onOpen={() => setActiveCreateSide(side)}
					side={side}
					sourceAgentId={agent.id}
				/>
			))}

			<div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-neutral-900 shadow-2xl shadow-black/40">
				<div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-neutral-800/60 px-5">
					{isEditingName ? (
						<input
							value={nameDraft}
							disabled={isSavingName}
							autoFocus
							style={{ width: `${Math.min(Math.max(nameDraft.length + 1, 8), 30)}ch` }}
							onChange={(event) => setNameDraft(event.currentTarget.value)}
							onBlur={() => void commitName()}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									event.currentTarget.blur()
								}
								if (event.key === "Escape") {
									skipNameCommitRef.current = true
									setNameDraft(agent.name)
									setIsEditingName(false)
								}
							}}
							className="nodrag min-w-0 max-w-full bg-transparent text-sm font-semibold tracking-wide text-neutral-100 outline-none"
							aria-label="Agent name"
						/>
					) : (
						<button
							type="button"
							onClick={() => {
								setNameDraft(agent.name)
								setIsEditingName(true)
							}}
							className="min-w-0 max-w-full cursor-text truncate text-left text-sm font-semibold tracking-wide text-neutral-100"
							title="Rename agent"
						>
							{agent.name}
						</button>
					)}
					<button
						type="button"
						onClick={requestDelete}
						onBlur={() => setDeleteArmed(false)}
						onMouseLeave={() => setDeleteArmed(false)}
						disabled={deleting || isDeleting}
						className={`min-w-20 cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
							deleteArmed
								? "border-red-500/60 bg-red-500/10 text-red-300"
								: "border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/10"
						}`}
					>
						{deleting || isDeleting ? "Deleting..." : deleteArmed ? "Confirm" : "Delete"}
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					<div className="flex w-[28%] shrink-0 flex-col gap-5 border-r border-white/5 px-4 py-4">
						<TaskList />

						<div className="flex flex-col gap-1">
							<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
								Model
							</span>
							<div className="relative">
								<select
									value={model}
									onChange={(event) => updateModel(event.currentTarget.value)}
									className="w-full cursor-pointer appearance-none rounded-md border border-white/5 bg-white/[0.03] px-2 py-1.5 pr-7 font-mono text-xs text-neutral-400 outline-none transition-colors duration-150 hover:border-white/10 hover:text-neutral-200 focus:border-white/20"
								>
									{MODEL_OPTIONS.map((group) => (
										<optgroup key={group.group} label={group.group}>
											{group.models.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</optgroup>
									))}
								</select>
								<ChevronDown
									size={12}
									className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-neutral-600"
								/>
							</div>
							{runtimeModel && runtimeModel !== agent.model ? (
								<span className="break-words font-mono text-[10px] text-neutral-600">
									running {runtimeModel}
								</span>
							) : null}
						</div>
					</div>

					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						<div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
							<div className="flex items-center gap-1">
								{PRIORITY_LEVELS.map((level) => (
									<button
										type="button"
										key={level}
										onClick={() => updateEffort(level)}
										className={`cursor-pointer rounded-md border px-2 py-0.5 text-[11px] capitalize transition-colors ${
											effort === level
												? EFFORT_STYLES[level]
												: "border-white/5 bg-transparent text-neutral-700 hover:border-white/10 hover:text-neutral-500"
										}`}
									>
										{level}
									</button>
								))}
							</div>
							{scopeDisplay ? (
								<span className="min-w-0 truncate text-xs text-neutral-600">
									Scope:{" "}
									<button
										type="button"
										onClick={() => setScopeModalOpen(true)}
										className="max-w-[260px] cursor-pointer truncate align-bottom font-mono text-blue-400/80 transition-colors duration-150 hover:text-blue-300"
										title={scopePath}
									>
										{scopeDisplay}
									</button>
								</span>
							) : null}
						</div>

						<div className="min-h-0 flex-1">
							<Chat
								thread={thread}
								threadId={agentThreadId}
								isRunning={isRunning}
								cwd={workspacePath}
								model={model}
								onFirstMessage={handleFirstMessage}
								provider={agent.provider}
								workspaceId={workspaceId}
							/>
						</div>
					</div>
				</div>
			</div>

			{scopeModalOpen ? (
				<AgentCardScopeModal
					agentName={agent.name}
					initialScopePath={scopePath}
					onCancel={() => setScopeModalOpen(false)}
					onSave={updateScope}
					projectPath={workspacePath}
				/>
			) : null}
		</div>
	)
}
