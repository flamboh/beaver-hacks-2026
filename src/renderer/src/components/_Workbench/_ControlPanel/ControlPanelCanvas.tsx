import AgentCard, { type CreateSide } from "./AgentCard"
import { type CanvasLayout, cardPos } from "./controlPanelLayout"
import ToolCard from "./ToolCard"
import type { ControlPanelCard, StartCardInput } from "./useControlPanelAgents"

interface ControlPanelCanvasProps {
	cards: ControlPanelCard[]
	canvas: CanvasLayout
	draggedDuringPan: { current: boolean }
	focusedIdx: number
	offset: { x: number; y: number }
	deletingCardId: string | null
	onCreateCard: (input: StartCardInput) => Promise<void>
	onDeleteCard: (id: string) => Promise<void>
	onFocus: (idx: number) => void
	onSnap: (idx: number) => void
	smoothPan: boolean
	workspaceId: string
	workspacePath: string
	zoom: number
}

export function ControlPanelCanvas({
	cards,
	canvas,
	draggedDuringPan,
	focusedIdx,
	offset,
	deletingCardId,
	onCreateCard,
	onDeleteCard,
	onFocus,
	onSnap,
	smoothPan,
	workspaceId,
	workspacePath,
	zoom
}: ControlPanelCanvasProps) {
	return (
		<div
			style={{
				position: "absolute",
				width: canvas.w,
				height: canvas.h,
				transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
				transformOrigin: "0 0",
				willChange: "transform",
				transition: smoothPan ? "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)" : "none"
			}}
		>
			<div className="pointer-events-none absolute inset-0 rounded-sm border border-white/10" />
			{cards.map((card, i) => {
				const pos = cardPos(card, canvas)
				const focused = focusedIdx === i
				const sides = availableCreateSides(card, cards)
				return (
					<div
						key={card.id}
						className="absolute"
						style={{
							left: pos.x,
							top: pos.y,
							transition: smoothPan
								? "left 300ms cubic-bezier(0.4, 0, 0.2, 1), top 300ms cubic-bezier(0.4, 0, 0.2, 1)"
								: "none"
						}}
						onClick={(event) => {
							if (draggedDuringPan.current) {
								event.preventDefault()
								event.stopPropagation()
								return
							}
							onFocus(i)
						}}
						onDoubleClick={(event) => {
							event.preventDefault()
							onSnap(i)
						}}
					>
						<div
							className={`rounded-xl transition-shadow duration-150 ${
								focused ? "ring-2 ring-white/20 ring-offset-4 ring-offset-neutral-950" : ""
							}`}
						>
							{card.kind === "agent" ? (
								<AgentCard
									agent={card}
									availableCreateSides={sides}
									isDeleting={deletingCardId === card.id}
									onCreateCard={onCreateCard}
									onDeleteCard={onDeleteCard}
									workspaceId={workspaceId}
									workspacePath={workspacePath}
								/>
							) : (
								<ToolCard
									card={card}
									availableCreateSides={sides}
									isDeleting={deletingCardId === card.id}
									onCreateCard={onCreateCard}
									onDeleteCard={onDeleteCard}
									workspacePath={workspacePath}
								/>
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}

function availableCreateSides(card: ControlPanelCard, cards: ControlPanelCard[]): CreateSide[] {
	const sides: CreateSide[] = []
	if (!hasCardAt(cards, card.layout_x - 1, card.layout_y)) sides.push("left")
	if (!hasCardAt(cards, card.layout_x + 1, card.layout_y)) sides.push("right")
	if (!hasCardAt(cards, card.layout_x, card.layout_y - 1)) sides.push("top")
	if (!hasCardAt(cards, card.layout_x, card.layout_y + 1)) sides.push("bottom")
	return sides
}

function hasCardAt(cards: ControlPanelCard[], x: number, y: number): boolean {
	return cards.some((card) => card.layout_x === x && card.layout_y === y)
}
