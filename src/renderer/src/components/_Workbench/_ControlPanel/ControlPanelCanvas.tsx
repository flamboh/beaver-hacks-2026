import AgentCard, { type CreateSide } from "./AgentCard"
import { GitLaneActions } from "../../GitLaneActions"
import {
	CARD_H,
	CARD_W,
	LANE_LABEL_GUTTER,
	PADDING,
	STEP_Y,
	type CanvasLayout,
	cardPos
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
	onSnap: (idx: number) => void
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
	onSnap,
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
				const y = PADDING + (index - canvas.minY) * STEP_Y
				const active = workspace.id === activeWorkspaceId
				const hasCards = cards.some((card) => card.workspace_id === workspace.id)
				return (
					<div
						key={workspace.id}
						className="pointer-events-none absolute left-0 right-0 border-t border-white/8"
						style={{ top: y, height: CARD_H + LANE_LABEL_GUTTER }}
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
									top: LANE_LABEL_GUTTER + CARD_H / 2,
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
									onCreateWorkspace={onCreateWorkspace}
									onDeleteCard={onDeleteCard}
									workspaceId={card.workspace_id}
									workspaceName={card.workspaceName}
									workspacePath={card.workspacePath}
								/>
							) : (
								<ToolCard
									card={card}
									availableCreateSides={sides}
									isDeleting={deletingCardId === card.id}
									onCreateCard={onCreateCard}
									onCreateWorkspace={onCreateWorkspace}
									onDeleteCard={onDeleteCard}
									workspacePath={card.workspacePath}
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
	return sides
}

function hasCardAt(cards: ControlPanelCard[], x: number, y: number): boolean {
	return cards.some((card) => card.layout_x === x && card.layout_y === y)
}
