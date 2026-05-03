import { type FormEvent, type MouseEvent, useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAgentSnapshot } from "@renderer/agentStore"
import { Chat } from "@renderer/components/chat"
import { ChevronDown, Plus } from "lucide-react"
import type { AgentRow } from "@renderer/types/models"
import { ProviderIcon } from "./ControlPanelAgentLauncher"
import TaskList from "./TaskList"
import { CARD_H, CARD_W } from "./controlPanelLayout"
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
	onDeleted: () => void
	onDeleteAgent: (id: string) => Promise<void>
	workspaceId: string
	workspacePath: string
}

export default function AgentCard({
	agent,
	availableCreateSides,
	isDeleting,
	onCreateAgent,
	onDeleted,
	onDeleteAgent,
	workspaceId,
	workspacePath
}: Props) {
	const [activeCreateSide, setActiveCreateSide] = useState<CreateSide | null>(null)
	const [name, setName] = useState(agent.name)
	const [effort, setEffort] = useState(agent.effort)
	const [model, setModel] = useState(agent.model)
	const [scopePath, setScopePath] = useState(agent.scope_path)
	const [scopeModalOpen, setScopeModalOpen] = useState(false)
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const queryClient = useQueryClient()
	const snapshot = useAgentSnapshot()
	const activeThread =
		snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId) ?? null
	const session = activeThread?.session ?? null
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
			})
			.catch(() => setEffort(agent.effort))
	}
	const updateModel = (nextModel: string) => {
		setModel(nextModel)
		void window.api.agents
			.update({ id: agent.id, model: nextModel })
			.then((updatedAgent) => {
				setModel(updatedAgent.model)
			})
			.catch(() => setModel(agent.model))
	}
	const updateName = () => {
		const nextName = name.trim() || agent.name
		setName(nextName)
		void window.api.agents
			.update({ id: agent.id, name: nextName })
			.then((updatedAgent) => {
				setName(updatedAgent.name)
			})
			.catch(() => setName(agent.name))
	}
	const updateScope = async (nextScopePath: string) => {
		const updatedAgent = await window.api.agents.update({
			id: agent.id,
			scope_path: nextScopePath
		})
		setScopePath(updatedAgent.scope_path)
	}
	const deleteAgent = () => {
		setDeleting(true)
		void onDeleteAgent(agent.id)
			.then(onDeleted)
			.finally(() => setDeleting(false))
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
			status: "working",
			description: prompt
		})
		if (name === "New Agent") {
			const nextName = agentNameForPrompt(prompt)
			await window.api.agents.update({
				id: agent.id,
				name: nextName
			})
			setName(nextName)
			await queryClient.invalidateQueries({ queryKey: ["agents"] })
		}
		await queryClient.invalidateQueries({ queryKey: ["tasks", agent.id] })
	}

	return (
		<div
			className="group/card nodrag relative cursor-default text-white"
			style={{ width: CARD_W, height: CARD_H }}
			onMouseDown={clearSelectionOutsideText}
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
				<div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 bg-neutral-800/60 px-5">
					<input
						type="text"
						value={name}
						onChange={(event) => setName(event.currentTarget.value)}
						onBlur={updateName}
						onKeyDown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur()
						}}
						className="min-w-0 flex-1 cursor-text truncate bg-transparent pr-4 text-sm font-semibold tracking-wide text-neutral-100 outline-none transition-colors duration-150 hover:text-white focus:text-white"
					/>
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
								thread={activeThread}
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
				<ScopeModal
					agentName={name}
					initialScopePath={scopePath}
					onCancel={() => setScopeModalOpen(false)}
					onSave={updateScope}
					projectPath={workspacePath}
				/>
			) : null}
		</div>
	)
}

type ScopeModalProps = {
	agentName: string
	initialScopePath: string
	onCancel: () => void
	onSave: (scopePath: string) => Promise<void>
	projectPath: string
}

function ScopeModal({
	agentName,
	initialScopePath,
	onCancel,
	onSave,
	projectPath
}: ScopeModalProps) {
	const [mode, setMode] = useState<"describe" | "path">("path")
	const [description, setDescription] = useState("")
	const [path, setPath] = useState(initialScopePath)
	const [saving, setSaving] = useState(false)

	const fallbackFileName =
		parseScopePath(path) || `${agentName.trim().replace(/[^A-Za-z0-9._-]+/g, "-") || "agent"}-scope`

	const handleBrowse = async () => {
		const selectedPath = await window.api.dialog.selectFile()
		if (selectedPath) setPath(selectedPath)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setSaving(true)
		const nextScopePath =
			mode === "describe"
				? (
						await window.api.files.saveScopeFile({
							projectPath,
							fileName: fallbackFileName,
							contents: description
						})
					).relativePath
				: path
		await onSave(nextScopePath)
		setSaving(false)
		onCancel()
	}

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-md rounded-lg border border-white/10 bg-neutral-900 shadow-2xl"
			>
				<div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
					<h2 className="text-sm font-medium text-white">Edit Scope</h2>
				</div>
				<div className="flex flex-col gap-4 p-4">
					<div className="grid grid-cols-2 overflow-hidden rounded-md border border-white/5 text-xs">
						<button
							type="button"
							onClick={() => setMode("describe")}
							className={`cursor-pointer py-2 transition-colors ${
								mode === "describe"
									? "bg-white/8 text-white"
									: "text-neutral-500 hover:text-neutral-300"
							}`}
						>
							Describe
						</button>
						<button
							type="button"
							onClick={() => setMode("path")}
							className={`cursor-pointer py-2 transition-colors ${
								mode === "path"
									? "bg-white/8 text-white"
									: "text-neutral-500 hover:text-neutral-300"
							}`}
						>
							File Path
						</button>
					</div>

					{mode === "describe" ? (
						<textarea
							value={description}
							onChange={(event) => setDescription(event.currentTarget.value)}
							rows={5}
							placeholder="Describe what this agent should accomplish..."
							className="resize-none rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
						/>
					) : null}

					<div className="flex gap-2">
						<input
							type="text"
							value={path}
							onChange={(event) => setPath(event.currentTarget.value)}
							placeholder="./scopes/test-coverage.md"
							className="min-w-0 flex-1 rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 font-mono text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
						/>
						<button
							type="button"
							onClick={handleBrowse}
							className="cursor-pointer rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/15"
						>
							Browse
						</button>
					</div>
				</div>
				<div className="flex justify-end gap-2 border-t border-white/5 p-4">
					<button
						type="button"
						onClick={onCancel}
						disabled={saving}
						className="cursor-pointer rounded-md border border-white/8 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving}
						className="cursor-pointer rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</form>
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
