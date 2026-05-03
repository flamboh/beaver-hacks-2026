import { useState } from "react"
import { motion } from "motion/react"
import type { StartCardInput, ToolCard as ToolCardModel } from "./useControlPanelAgents"
import AgentCardSideCreateButton, { type CreateSide } from "./AgentCardSideCreateButton"
import type { CardSize } from "./controlPanelLayout"
import TerminalCard from "./TerminalCard"
import BrowserCard from "./BrowserCard"

interface ToolCardProps {
	card: ToolCardModel
	availableCreateSides: CreateSide[]
	isDeleting: boolean
	onCreateCard: (input: StartCardInput) => Promise<void>
	onCreateWorkspace: (sourceCardId: string, side: "top" | "bottom") => void
	onDeleteCard: (id: string) => Promise<void>
	size: CardSize
	workspacePath: string
}

export default function ToolCard({
	card,
	availableCreateSides,
	isDeleting,
	onCreateCard,
	onCreateWorkspace,
	onDeleteCard,
	size,
	workspacePath
}: ToolCardProps) {
	const [activeCreateSide, setActiveCreateSide] = useState<CreateSide | null>(null)
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [deleting, setDeleting] = useState(false)

	return (
		<div
			className="group/card nodrag relative cursor-default text-white transition-[width] duration-200 ease-out"
			style={{ width: size.w, height: size.h }}
			onWheel={(event) => event.stopPropagation()}
		>
			<motion.div
				whileHover={{ y: -1 }}
				whileTap={{ scale: 0.998 }}
				transition={{ type: "spring", duration: 0.3, bounce: 0 }}
				className="polished-surface flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-neutral-900 shadow-2xl shadow-black/40"
			>
				<div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-neutral-800/60 px-5">
					<span className="truncate text-sm font-semibold tracking-wide text-neutral-100 capitalize">
						{card.tool}
					</span>
					<button
						type="button"
						onClick={() => {
							if (!deleteArmed) {
								setDeleteArmed(true)
								return
							}
							setDeleting(true)
							void onDeleteCard(card.id).finally(() => setDeleting(false))
						}}
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
				<div className="min-h-0 flex-1">
					{card.tool === "terminal" ? (
						<TerminalCard cwd={workspacePath} />
					) : (
						<BrowserCard
							enterDevAction={card.enterDevAction}
							projectName={card.projectName}
							workspacePath={workspacePath}
						/>
					)}
				</div>
			</motion.div>
			{availableCreateSides.map((side) => (
				<AgentCardSideCreateButton
					key={side}
					active={activeCreateSide === side}
					onClose={() => setActiveCreateSide(null)}
					onCreateCard={onCreateCard}
					onCreateWorkspace={onCreateWorkspace}
					onOpen={() => setActiveCreateSide(side)}
					side={side}
					sourceCardId={card.id}
				/>
			))}
		</div>
	)
}
