import { type MouseEvent, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { motion } from "motion/react"
import { useAgentSnapshot } from "@renderer/agentStore"
import { Chat } from "@renderer/components/chat"
import type { AgentRow } from "@renderer/types/models"
import AgentCardSideCreateButton, { type CreateSide } from "./AgentCardSideCreateButton"
import TaskList from "./TaskList"
import type { CardSize } from "./controlPanelLayout"
import { agentNameForPrompt, type StartCardInput } from "./useControlPanelAgents"

export type { CreateSide }

interface Props {
	agent: AgentRow
	availableCreateSides: CreateSide[]
	isDeleting: boolean
	onCreateCard: (input: StartCardInput) => Promise<void>
	onCreateWorkspace: (sourceCardId: string, side: "top" | "bottom") => void
	onDeleteCard: (id: string) => Promise<void>
	size: CardSize
	workspaceId: string
	workspaceName: string
	workspacePath: string
}

export default function AgentCard({
	agent,
	availableCreateSides,
	isDeleting,
	onCreateCard,
	onCreateWorkspace,
	onDeleteCard,
	size,
	workspaceId,
	workspaceName,
	workspacePath
}: Props) {
	const [activeCreateSide, setActiveCreateSide] = useState<CreateSide | null>(null)
	const [isEditingName, setIsEditingName] = useState(false)
	const [nameDraft, setNameDraft] = useState(agent.name)
	const [isSavingName, setIsSavingName] = useState(false)
	const [effort, setEffort] = useState(agent.effort)
	const [model, setModel] = useState(agent.model)
	const [speedTier, setSpeedTier] = useState<string | null>(null)
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const skipNameCommitRef = useRef(false)
	const queryClient = useQueryClient()
	const snapshot = useAgentSnapshot()
	const agentThreadId = agent.thread_id ?? `thread:${agent.id}`
	const thread = snapshot.threads.find((agentThread) => agentThread.id === agentThreadId) ?? null
	const session = thread?.session ?? null
	const runtimeModel = session?.model ?? null
	const hasPlan = (thread?.plan.items.length ?? 0) > 0
	const isRunning =
		session !== null &&
		(session.status === "starting" || session.status === "running" || session.activeTurnId !== null)

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
	const deleteAgent = () => {
		setDeleting(true)
		void onDeleteCard(agent.id).finally(() => setDeleting(false))
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
		} else if (!agent.thread_id) {
			await window.api.agents.update({
				id: agent.id,
				thread_id: agentThreadId
			})
			await queryClient.invalidateQueries({ queryKey: ["agents"] })
		}
		await queryClient.invalidateQueries({ queryKey: ["tasks", agent.id] })
	}

	async function handleMessageSent(prompt: string): Promise<void> {
		await window.api.workspaces.touchPrompted({ id: workspaceId })
		const nextWorkspaceName = workspaceNameForPrompt(workspaceName, prompt)
		if (nextWorkspaceName && nextWorkspaceName !== workspaceName) {
			await window.api.workspaces.update({
				id: workspaceId,
				name: nextWorkspaceName,
				path: workspacePath
			})
		}
		await queryClient.invalidateQueries({ queryKey: ["workspaces"] })
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
			className="group/card nodrag relative cursor-default text-white transition-[width] duration-200 ease-out"
			style={{ width: size.w, height: size.h }}
			onMouseDown={clearSelectionOutsideText}
			onWheel={(event) => event.stopPropagation()}
		>
			{availableCreateSides.map((side) => (
				<AgentCardSideCreateButton
					key={side}
					active={activeCreateSide === side}
					onClose={() => setActiveCreateSide(null)}
					onCreateCard={onCreateCard}
					onCreateWorkspace={onCreateWorkspace}
					onOpen={() => setActiveCreateSide(side)}
					side={side}
					sourceCardId={agent.id}
				/>
			))}

			<motion.div
				whileHover={{ y: -1 }}
				whileTap={{ scale: 0.998 }}
				transition={{ type: "spring", duration: 0.3, bounce: 0 }}
				className="polished-surface flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-neutral-900 shadow-2xl shadow-black/40"
			>
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
						className={`polished-button min-w-20 cursor-pointer rounded-md border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60 ${
							deleteArmed
								? "border-red-500/60 bg-red-500/10 text-red-300"
								: "border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/10"
						}`}
					>
						{deleting || isDeleting ? "Deleting..." : deleteArmed ? "Confirm" : "Terminate"}
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					{hasPlan ? (
						<div className="flex w-[28%] shrink-0 flex-col gap-5 border-r border-white/5 px-4 py-4">
							<TaskList plan={thread?.plan ?? null} />
						</div>
					) : null}

					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						<div className="min-h-0 flex-1">
							<Chat
								thread={thread}
								threadId={agentThreadId}
								isRunning={isRunning}
								cwd={workspacePath}
								model={model}
								runtimeModel={runtimeModel}
								effort={effort}
								speedTier={speedTier}
								onModelChange={updateModel}
								onMessageSent={handleMessageSent}
								onEffortChange={updateEffort}
								onSpeedTierChange={setSpeedTier}
								onFirstMessage={handleFirstMessage}
								provider={agent.provider}
							/>
						</div>
					</div>
				</div>
			</motion.div>
		</div>
	)
}

const WORKSPACE_NAME_STOP_WORDS = new Set([
	"a",
	"add",
	"an",
	"and",
	"build",
	"can",
	"for",
	"i",
	"in",
	"make",
	"me",
	"of",
	"on",
	"the",
	"this",
	"to",
	"with"
])

function workspaceNameForPrompt(currentName: string, prompt: string): string | null {
	if (!isProvisionalWorkspaceName(currentName)) return null
	const words = prompt.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []
	const topicWords = words
		.filter((word) => !WORKSPACE_NAME_STOP_WORDS.has(word))
		.slice(0, 4)
		.map((word) => word.replace(/'/g, ""))
	const name = topicWords.join("-")
	return name || null
}

function isProvisionalWorkspaceName(name: string): boolean {
	const normalized = name.toLowerCase()
	return (
		normalized === "source" ||
		normalized === "main" ||
		normalized.includes("-work-") ||
		/^source-\d+$/.test(normalized)
	)
}
