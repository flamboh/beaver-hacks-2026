import { useCallback, useRef, useState } from "react"
import { Chat } from "@renderer/components/chat"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAgentSnapshot } from "@renderer/agentStore"
import { Plus } from "lucide-react"
import type { AgentRow } from "@renderer/types/models"
import { CARD_H, CARD_W } from "./controlPanelLayout"
import { ProviderIcon } from "./ControlPanelAgentLauncher"
import { agentNameForPrompt, type StartAgentInput } from "./useControlPanelAgents"

function parseScopePath(path: string): string {
	if (!path) return ""
	const parts = path.replace(/\\/g, "/").split("/")
	return (
		parts.findLast((segment) => segment.endsWith(".md") || segment.endsWith(".txt")) ??
		parts.at(-1) ??
		""
	)
}

const PRIORITY_LEVELS = ["low", "medium", "high"] as const

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
	const skipNameCommitRef = useRef(false)
	const queryClient = useQueryClient()
	const snapshot = useAgentSnapshot()
	const activeThread =
		snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId) ?? null
	const session = activeThread?.session ?? null
	const isRunning =
		session !== null &&
		(session.status === "starting" || session.status === "running" || session.activeTurnId !== null)
	const { data: tasks = [] } = useQuery({
		queryKey: ["tasks", agent.id],
		queryFn: () => window.api.tasks.list(agent.id),
		enabled: Boolean(agent.id)
	})
	const scopeDisplay = parseScopePath(agent.scope_path)

	async function handleFirstMessage(prompt: string): Promise<void> {
		await window.api.tasks.create({
			agent_id: agent.id,
			status: "working",
			description: prompt
		})
		if (agent.name === "New Agent") {
			const seedName = agentNameForPrompt(prompt)
			await window.api.agents.update({
				id: agent.id,
				name: seedName
			})
			await queryClient.invalidateQueries({ queryKey: ["agents"] })
			void window.api.agent
				.generateName({ cwd: workspacePath, prompt })
				.then(async ({ name }) => {
					if (!name || name === seedName || name === "New Agent") return
					await window.api.agents.update({
						id: agent.id,
						name,
						expectedName: seedName
					})
					await queryClient.invalidateQueries({ queryKey: ["agents"] })
				})
				.catch(() => undefined)
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
			className="group/card relative text-white"
			style={{ width: CARD_W, height: CARD_H }}
			onWheel={(event) => event.stopPropagation()}
		>
			{availableCreateSides.map((side) => (
				<SideCreateButton
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
							className="min-w-0 max-w-full truncate text-left text-sm font-semibold tracking-wide text-neutral-100"
							title="Rename agent"
						>
							{agent.name}
						</button>
					)}
					<button
						type="button"
						disabled={isDeleting}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
							void onDeleteAgent(agent.id)
						}}
						className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-400 transition-all duration-150 hover:border-red-500/60 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Delete
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					<div className="flex w-[35%] shrink-0 flex-col gap-5 border-r border-white/5 px-4 py-4">
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
								Task List
							</span>
							<div className="nowheel nodrag min-h-0 flex-1 overflow-y-auto pr-1">
								{tasks.length === 0 ? (
									<p className="text-xs text-neutral-700">No tasks yet</p>
								) : (
									<ol className="flex flex-col gap-1.5">
										{tasks.map((task, i) => (
											<li key={task.id} className="flex items-start gap-2 text-sm text-neutral-400">
												<span className="mt-px shrink-0 tabular-nums text-neutral-700">
													{i + 1}.
												</span>
												<span className="min-w-0 break-words leading-snug">{task.description}</span>
											</li>
										))}
									</ol>
								)}
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
								Model
							</span>
							<span className="break-words font-mono text-xs text-neutral-400">{agent.model}</span>
						</div>
					</div>

					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						<div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
							<div className="flex items-center gap-1">
								{PRIORITY_LEVELS.map((level) => (
									<span
										key={level}
										className={`rounded-md border px-2 py-0.5 text-[11px] capitalize transition-colors ${
											agent.effort === level
												? EFFORT_STYLES[level]
												: "border-white/5 bg-transparent text-neutral-700"
										}`}
									>
										{level}
									</span>
								))}
							</div>
							{scopeDisplay ? (
								<span className="min-w-0 truncate text-xs text-neutral-600">
									Scope: <span className="font-mono text-blue-400/80">{scopeDisplay}</span>
								</span>
							) : null}
						</div>

						<div className="min-h-0 flex-1">
							<Chat
								thread={activeThread}
								isRunning={isRunning}
								cwd={workspacePath}
								model={agent.model}
								onFirstMessage={handleFirstMessage}
								provider={agent.provider}
								workspaceId={workspaceId}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export type CreateSide = "left" | "right" | "top" | "bottom"

const PROVIDERS: StartAgentInput[] = [{ provider: "codex" }, { provider: "claude" }]

function SideCreateButton({
	active,
	onClose,
	onCreateAgent,
	onOpen,
	side,
	sourceAgentId
}: {
	active: boolean
	onClose: () => void
	onCreateAgent: (input: StartAgentInput) => Promise<void>
	onOpen: () => void
	side: CreateSide
	sourceAgentId: string
}) {
	const lightDismissCleanup = useRef<(() => void) | null>(null)
	const sideClass: Record<CreateSide, string> = {
		left: "left-[-62px] top-1/2 -translate-y-1/2",
		right: "right-[-62px] top-1/2 -translate-y-1/2",
		top: "left-1/2 top-[-62px] -translate-x-1/2",
		bottom: "bottom-[-62px] left-1/2 -translate-x-1/2"
	}
	const setPopoverRef = useCallback(
		(node: HTMLDivElement | null) => {
			lightDismissCleanup.current?.()
			lightDismissCleanup.current = null
			if (!node) return
			const popover = node

			function handlePointerDown(event: PointerEvent): void {
				if (popover.contains(event.target as Node | null)) return
				lightDismissCleanup.current?.()
				lightDismissCleanup.current = null
				onClose()
			}

			const timer = window.setTimeout(() => {
				document.addEventListener("pointerdown", handlePointerDown, true)
			}, 0)
			lightDismissCleanup.current = () => {
				window.clearTimeout(timer)
				document.removeEventListener("pointerdown", handlePointerDown, true)
			}
		},
		[onClose]
	)

	return (
		<div className={`nodrag absolute z-40 ${sideClass[side]}`}>
			<button
				type="button"
				onClick={(event) => {
					event.preventDefault()
					event.stopPropagation()
					if (active) {
						onClose()
						return
					}
					onOpen()
				}}
				className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-neutral-400 opacity-35 transition-all duration-150 hover:scale-110 hover:text-white hover:opacity-100 group-hover/card:opacity-70"
				aria-label="Start another agent"
				title="Start another agent"
			>
				<Plus size={17} />
			</button>
			{active ? (
				<div
					ref={setPopoverRef}
					className="agent-create-popover absolute top-1/2 left-1/2 z-50 flex w-[120px] items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 p-2 shadow-2xl shadow-black/50"
					onClick={(event) => event.stopPropagation()}
				>
					{PROVIDERS.map((provider) => (
						<button
							key={provider.provider}
							type="button"
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								void onCreateAgent({
									...provider,
									sourceAgentId,
									side
								}).then(onClose)
							}}
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/8 bg-neutral-950 text-neutral-400 transition-colors duration-150 hover:border-white/15 hover:bg-white/8 hover:text-white"
							aria-label={`Start ${provider.provider} agent`}
							title={provider.provider}
						>
							<ProviderIcon provider={provider.provider} />
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}
