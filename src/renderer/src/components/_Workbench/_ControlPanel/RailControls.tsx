import {
	Archive,
	ArrowDown,
	ArrowUp,
	Code2,
	CopyPlus,
	Folder,
	MoreHorizontal,
	Play,
	Save,
	Scissors
} from "lucide-react"
import { type ReactNode, useState } from "react"
import { presetItemsForCards, readRailPresets, writeRailPresets } from "./railPresets"
import type { ControlPanelCard, StartCardInput, WorkspaceLane } from "./useControlPanelAgents"

const RAIL_COLORS = ["#737373", "#60a5fa", "#34d399", "#f59e0b", "#f87171", "#c084fc"]

interface RailControlsProps {
	canMoveDown: boolean
	canMoveUp: boolean
	cards: ControlPanelCard[]
	isActive: boolean
	workspace: WorkspaceLane
	onApplyPreset: (items: StartCardInput[]) => Promise<void>
	onArchive: (workspace: WorkspaceLane) => void
	onCreate: (workspaceId: string) => void
	onKill: (workspace: WorkspaceLane) => void
	onMove: (workspaceId: string, direction: "up" | "down") => void
	onOpen: (workspace: WorkspaceLane, target: "finder" | "editor") => void
	onRun: (workspace: WorkspaceLane) => void
	onUpdate: (input: { id: string; name?: string; railColor?: string }) => void
}

export default function RailControls({
	canMoveDown,
	canMoveUp,
	cards,
	isActive,
	workspace,
	onApplyPreset,
	onArchive,
	onCreate,
	onKill,
	onMove,
	onOpen,
	onRun,
	onUpdate
}: RailControlsProps) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(workspace.name)
	const [menuOpen, setMenuOpen] = useState(false)
	const [hint, setHint] = useState("Hover an action.")
	const [presets, setPresets] = useState(readRailPresets)

	function commitName(): void {
		const name = draft.trim()
		setEditing(false)
		if (!name || name === workspace.name) {
			setDraft(workspace.name)
			return
		}
		onUpdate({ id: workspace.id, name })
	}

	function savePreset(): void {
		const items = presetItemsForCards(cards, workspace.id)
		if (items.length === 0) return
		const nextPresets = [
			...presets,
			{ id: crypto.randomUUID(), name: `${workspace.name} preset`, items }
		]
		setPresets(nextPresets)
		writeRailPresets(nextPresets)
	}

	return (
		<div className="pointer-events-auto relative flex max-w-[760px] items-center gap-1.5 rounded-md border border-white/8 bg-neutral-950/95 px-2 py-1 shadow-lg shadow-black/30">
			<span
				className="size-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: workspace.railColor }}
			/>
			<span className="truncate text-[11px] font-medium text-neutral-500">
				{workspace.projectName}
			</span>
			<span className="text-[11px] text-neutral-700">/</span>
			{editing ? (
				<input
					value={draft}
					autoFocus
					onChange={(event) => setDraft(event.currentTarget.value)}
					onBlur={commitName}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur()
						if (event.key === "Escape") {
							setDraft(workspace.name)
							setEditing(false)
						}
					}}
					className="w-32 bg-transparent text-[11px] font-medium text-neutral-100 outline-none"
				/>
			) : (
				<button
					type="button"
					onClick={() => {
						setDraft(workspace.name)
						setEditing(true)
					}}
					className="max-w-40 cursor-text truncate text-left text-[11px] font-medium text-neutral-300"
					title="Rename rail"
				>
					{workspace.name}
				</button>
			)}
			<button
				type="button"
				onClick={() => setMenuOpen((open) => !open)}
				className="ml-1 flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-white/5 hover:text-white"
				aria-label="Rail options"
				title="Rail options"
			>
				<MoreHorizontal size={14} />
			</button>
			{menuOpen ? (
				<div className="nodrag absolute top-8 left-0 z-50 w-72 rounded-lg border border-white/10 bg-neutral-900 p-2 shadow-2xl shadow-black/60">
					<div className="grid grid-cols-6 gap-1 border-b border-white/8 pb-2">
						{RAIL_COLORS.map((color) => (
							<button
								key={color}
								type="button"
								onMouseEnter={() => setHint(`Tint this rail ${color}.`)}
								onClick={() => onUpdate({ id: workspace.id, railColor: color })}
								className="h-6 rounded-md border border-white/10"
								style={{ backgroundColor: color }}
								aria-label={`Set rail color ${color}`}
								title={`Set rail color ${color}`}
							/>
						))}
					</div>
					<div className="mt-2 grid grid-cols-2 gap-1">
						<MenuItem
							hint="Create a new rail duplicated from this workspace."
							icon={<CopyPlus size={13} />}
							label="Duplicate"
							onHint={setHint}
							onClick={() => onCreate(workspace.id)}
						/>
						<MenuItem
							hint="Reveal this workspace directory in Finder."
							icon={<Folder size={13} />}
							label="Finder"
							onHint={setHint}
							onClick={() => onOpen(workspace, "finder")}
						/>
						<MenuItem
							hint="Open this workspace in the configured editor."
							icon={<Code2 size={13} />}
							label="Editor"
							onHint={setHint}
							onClick={() => onOpen(workspace, "editor")}
						/>
						<MenuItem
							hint="Run this project's configured flow for the rail."
							icon={<Play size={13} />}
							label="Run flow"
							onHint={setHint}
							onClick={() => onRun(workspace)}
						/>
						<MenuItem
							hint="Stop agents, terminals, and dev server for this rail."
							icon={<Scissors size={13} />}
							label="Kill"
							onHint={setHint}
							onClick={() => onKill(workspace)}
						/>
						<MenuItem
							hint="Save this rail's current card composition locally."
							icon={<Save size={13} />}
							label="Save preset"
							onHint={setHint}
							onClick={savePreset}
						/>
						<MenuItem
							disabled={!isActive || !canMoveUp}
							hint="Move the rail you're currently on upward. Use Option+Up too."
							icon={<ArrowUp size={13} />}
							label="Move up"
							onHint={setHint}
							onClick={() => onMove(workspace.id, "up")}
						/>
						<MenuItem
							disabled={!isActive || !canMoveDown}
							hint="Move the rail you're currently on downward. Use Option+Down too."
							icon={<ArrowDown size={13} />}
							label="Move down"
							onHint={setHint}
							onClick={() => onMove(workspace.id, "down")}
						/>
						<MenuItem
							danger
							hint="Hide this rail without deleting its files."
							icon={<Archive size={13} />}
							label="Archive"
							onHint={setHint}
							onClick={() => onArchive(workspace)}
						/>
					</div>
					{presets.length > 0 ? (
						<div className="mt-2 border-t border-white/8 pt-2">
							<p className="mb-1 text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
								Presets
							</p>
							<div className="flex flex-col gap-1">
								{presets.map((preset) => (
									<button
										key={preset.id}
										type="button"
										onMouseEnter={() => setHint(`Apply ${preset.name} to this rail.`)}
										onClick={() => void onApplyPreset(preset.items)}
										className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white"
										title={`Apply ${preset.name}`}
									>
										<span className="truncate">{preset.name}</span>
										<span className="text-neutral-600">{preset.items.length}</span>
									</button>
								))}
							</div>
						</div>
					) : null}
					<div className="mt-2 min-h-8 rounded-md border border-white/8 bg-neutral-950 px-2 py-1.5 text-[11px] leading-4 text-neutral-500">
						{hint}
					</div>
				</div>
			) : null}
		</div>
	)
}

function MenuItem({
	danger,
	disabled,
	hint,
	icon,
	label,
	onClick,
	onHint
}: {
	danger?: boolean
	disabled?: boolean
	hint: string
	icon: ReactNode
	label: string
	onClick: () => void
	onHint: (hint: string) => void
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onMouseEnter={() => onHint(disabled ? "Select this rail before reordering." : hint)}
			onClick={onClick}
			className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
				danger
					? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
					: "text-neutral-400 hover:bg-white/5 hover:text-white"
			}`}
			title={hint}
		>
			{icon}
			<span className="truncate">{label}</span>
		</button>
	)
}
