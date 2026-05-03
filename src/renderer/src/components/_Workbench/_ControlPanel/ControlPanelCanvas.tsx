import AgentCard, { type CardTypingHandle, type CreateSide } from "./AgentCard"
import { GitLaneActions } from "../../GitLaneActions"
import { AnimatePresence, motion } from "motion/react"
import {
	CARD_H,
	CARD_W,
	LANE_LABEL_GUTTER,
	PADDING,
	STEP_Y,
	VERTICAL_PADDING,
	type CardSize,
	type CanvasLayout,
	cardSize,
	cardPos,
	snapCardWidth
} from "./controlPanelLayout"
import ControlPanelAgentLauncher from "./ControlPanelAgentLauncher"
import ToolCard from "./ToolCard"
import type { ControlPanelCard, StartCardInput, WorkspaceLane } from "./useControlPanelAgents"

interface ControlPanelCanvasProps {
	activeWorkspaceId: string
	cards: ControlPanelCard[]
	canvas: CanvasLayout
	draggedDuringPan: { current: boolean }
	focusedIdx: number
	offset: { x: number; y: number }
	deletingCardId: string | null
	isCreatingCard: boolean
	onCreateCard: (input: StartCardInput) => Promise<void>
	onCreateWorkspace: (sourceCardId: string, side: "top" | "bottom") => void
	onDeleteCard: (id: string) => Promise<void>
	onFocus: (idx: number) => void
	onResizeCard: (id: string, size: CardSize) => void
	onSnap: (idx: number) => void
	onTypingRef: (id: string, handle: CardTypingHandle | null) => void
	smoothPan: boolean
	workspaces: WorkspaceLane[]
	zoom: number
}

export function ControlPanelCanvas({
	activeWorkspaceId,
	cards,
	canvas,
	draggedDuringPan,
	focusedIdx,
	offset,
	deletingCardId,
	isCreatingCard,
	onCreateCard,
	onCreateWorkspace,
	onDeleteCard,
	onFocus,
	onResizeCard,
	onSnap,
	onTypingRef,
	smoothPan,
	workspaces,
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
			{workspaces.map((workspace, index) => {
				const y = VERTICAL_PADDING + (index - canvas.minY) * STEP_Y
				const rowTop = canvas.rowTops.get(index) ?? y
				const rowHeight = canvas.rowHeights.get(index) ?? CARD_H
				const active = workspace.id === activeWorkspaceId
				const hasCards = cards.some((card) => card.workspace_id === workspace.id)
				return (
					<div
						key={workspace.id}
						className="pointer-events-none absolute left-0 right-0 border-t border-white/8"
						style={{ top: rowTop, height: rowHeight + LANE_LABEL_GUTTER }}
					>
						<div className="absolute top-4 left-8 flex max-w-[680px] items-center gap-2">
							<span className="truncate rounded bg-neutral-950 px-2 py-1 text-[11px] font-medium text-neutral-500">
								<span className="text-blue-300">{workspace.projectName}</span>
								<span className="px-1 text-neutral-700">/</span>
								{workspace.name}
							</span>
							<GitLaneActions workspaceId={workspace.id} workspaceName={workspace.name} />
						</div>
						{active && !hasCards ? (
							<div
								className="pointer-events-auto absolute"
								style={{
									left: PADDING + CARD_W / 2,
									top: LANE_LABEL_GUTTER + rowHeight / 2,
									transform: "translate(-50%, -50%)"
								}}
							>
								<ControlPanelAgentLauncher
									hasAgents={false}
									isCreatingCard={isCreatingCard}
									onCreateCard={onCreateCard}
								/>
							</div>
						) : null}
					</div>
				)
			})}
			<AnimatePresence initial={false}>
				{cards.map((card, i) => {
					const pos = cardPos(card, canvas)
					const size = cardSize(card)
					const focused = focusedIdx === i
					const sides = availableCreateSides(card, cards)
					return (
						<motion.div
							key={card.id}
							className="absolute has-[.agent-create-popover]:z-50"
							initial={{ opacity: 0, scale: 0.96, y: 14, filter: "blur(5px)" }}
							animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, scale: 0.98, y: -6, filter: "blur(3px)" }}
							transition={{ type: "spring", duration: 0.34, bounce: 0 }}
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
								className={`rounded-xl transition-[box-shadow,outline-color] duration-150 ${
									focused ? "ring-2 ring-white/20 ring-offset-4 ring-offset-neutral-950" : ""
								}`}
							>
								{card.kind === "agent" ? (
									<AgentCard
										ref={(handle) => onTypingRef(card.id, handle)}
										agent={card}
										availableCreateSides={sides}
										isDeleting={deletingCardId === card.id}
										onCreateCard={onCreateCard}
										onCreateWorkspace={onCreateWorkspace}
										onDeleteCard={onDeleteCard}
										size={size}
										workspaceId={card.workspace_id}
										workspaceName={card.workspaceName}
										workspacePath={card.workspacePath}
									/>
								) : (
									<ToolCard
										ref={(handle) => onTypingRef(card.id, handle)}
										card={card}
										availableCreateSides={sides}
										isDeleting={deletingCardId === card.id}
										onCreateCard={onCreateCard}
										onCreateWorkspace={onCreateWorkspace}
										onDeleteCard={onDeleteCard}
										size={size}
										workspacePath={card.workspacePath}
									/>
								)}
							</div>
							<ResizeHandle cardId={card.id} onResize={onResizeCard} side="left" size={size} />
							<ResizeHandle cardId={card.id} onResize={onResizeCard} side="right" size={size} />
						</motion.div>
					)
				})}
			</AnimatePresence>
		</div>
	)
}

function ResizeHandle({
	cardId,
	onResize,
	side,
	size
}: {
	cardId: string
	onResize: (id: string, size: CardSize) => void
	side: "left" | "right"
	size: CardSize
}) {
	return (
		<div
			role="separator"
			aria-label={`Resize panel from ${side}`}
			title="Resize panel"
			onPointerDown={(event) => {
				event.preventDefault()
				event.stopPropagation()
				const pointerId = event.pointerId
				const start = { x: event.clientX, w: size.w, h: size.h }
				event.currentTarget.setPointerCapture(pointerId)

				const move = (moveEvent: PointerEvent): void => {
					if (moveEvent.pointerId !== pointerId) return
					const delta = moveEvent.clientX - start.x
					onResize(cardId, {
						w: snapCardWidth(side === "right" ? start.w + delta : start.w - delta),
						h: start.h
					})
				}
				const cleanup = (endEvent: PointerEvent): void => {
					if (endEvent.pointerId !== pointerId) return
					window.removeEventListener("pointermove", move)
					window.removeEventListener("pointerup", cleanup)
					window.removeEventListener("pointercancel", cleanup)
				}

				window.addEventListener("pointermove", move)
				window.addEventListener("pointerup", cleanup)
				window.addEventListener("pointercancel", cleanup)
			}}
			className={`nodrag absolute top-11 z-50 h-[calc(100%-2.75rem)] w-3 cursor-ew-resize ${
				side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
			}`}
		/>
	)
}

function availableCreateSides(card: ControlPanelCard, cards: ControlPanelCard[]): CreateSide[] {
	const sides: CreateSide[] = []
	if (!hasCardAt(cards, card.layout_x - 1, card.layout_y)) sides.push("left")
	if (!hasCardAt(cards, card.layout_x + 1, card.layout_y)) sides.push("right")
	return sides
}

function hasCardAt(cards: ControlPanelCard[], x: number, y: number): boolean {
	return cards.some((card) => card.layout_x === x && card.layout_y === y)
}
