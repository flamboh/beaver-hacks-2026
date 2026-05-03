import { Plus } from "lucide-react"
import CreateCardOptionsPopover from "./CreateCardOptionsPopover"
import type { StartCardInput } from "./useControlPanelAgents"

export type CreateSide = "left" | "right" | "top" | "bottom"

export default function AgentCardSideCreateButton({
	active,
	onClose,
	onCreateCard,
	onCreateWorkspace,
	onOpen,
	side,
	sourceCardId
}: {
	active: boolean
	onClose: () => void
	onCreateCard: (input: StartCardInput) => Promise<void>
	onCreateWorkspace?: (sourceCardId: string, side: "top" | "bottom") => void
	onOpen: () => void
	side: CreateSide
	sourceCardId: string
}) {
	const sideClass: Record<CreateSide, string> = {
		left: "left-[-62px] top-1/2 -translate-y-1/2",
		right: "right-[-62px] top-1/2 -translate-y-1/2",
		top: "left-1/2 top-[-62px] -translate-x-1/2",
		bottom: "bottom-[-62px] left-1/2 -translate-x-1/2"
	}

	return (
		<div className={`nodrag absolute z-40 ${sideClass[side]}`}>
			<button
				type="button"
				onClick={(event) => {
					event.preventDefault()
					event.stopPropagation()
					if ((side === "top" || side === "bottom") && onCreateWorkspace) {
						onCreateWorkspace(sourceCardId, side)
						return
					}
					if (active) {
						onClose()
						return
					}
					onOpen()
				}}
				className="polished-button flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-neutral-400 opacity-35 hover:scale-110 hover:text-white hover:opacity-100 group-hover/card:opacity-70"
				aria-label={side === "top" || side === "bottom" ? "Create workspace" : "Create card"}
				title={side === "top" || side === "bottom" ? "Create workspace" : "Create card"}
			>
				<Plus size={17} />
			</button>
			{active ? (
				<CreateCardOptionsPopover
					onClose={onClose}
					onCreateCard={onCreateCard}
					side={side}
					sourceCardId={sourceCardId}
					className="absolute top-1/2 left-1/2"
				/>
			) : null}
		</div>
	)
}
