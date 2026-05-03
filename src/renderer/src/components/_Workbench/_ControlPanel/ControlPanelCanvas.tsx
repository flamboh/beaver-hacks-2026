import AgentCard, { type CreateSide } from "./AgentCard"
import type { AgentRow } from "@renderer/types/models"
import { type CanvasLayout, cardPos } from "./controlPanelLayout"
import type { StartAgentInput } from "./useControlPanelAgents"

interface ControlPanelCanvasProps {
	agents: AgentRow[]
	canvas: CanvasLayout
	draggedDuringPan: { current: boolean }
	focusedIdx: number
	offset: { x: number; y: number }
	deletingAgentId: string | null
	onCreateAgent: (input: StartAgentInput) => Promise<void>
	onDeleteAgent: (id: string) => Promise<void>
	onFocus: (idx: number) => void
	onAgentDeleted: () => void
	onSnap: (idx: number) => void
	smoothPan: boolean
	workspaceId: string
	workspacePath: string
	zoom: number
}

export function ControlPanelCanvas({
	agents,
	canvas,
	draggedDuringPan,
	focusedIdx,
	offset,
	deletingAgentId,
	onCreateAgent,
	onDeleteAgent,
	onFocus,
	onAgentDeleted,
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
			{agents.map((agent, i) => {
				const pos = cardPos(agent, canvas)
				const focused = focusedIdx === i
				return (
					<div
						key={agent.id}
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
							<AgentCard
								agent={agent}
								availableCreateSides={availableCreateSides(agent, agents)}
								isDeleting={deletingAgentId === agent.id}
								onCreateAgent={onCreateAgent}
								onDeleted={onAgentDeleted}
								onDeleteAgent={onDeleteAgent}
								workspaceId={workspaceId}
								workspacePath={workspacePath}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}

function availableCreateSides(agent: AgentRow, agents: AgentRow[]): CreateSide[] {
	const sides: CreateSide[] = []
	if (!hasAgentAt(agents, agent.layout_x - 1, agent.layout_y)) sides.push("left")
	if (!hasAgentAt(agents, agent.layout_x + 1, agent.layout_y)) sides.push("right")
	if (!hasAgentAt(agents, agent.layout_x, agent.layout_y - 1)) sides.push("top")
	if (!hasAgentAt(agents, agent.layout_x, agent.layout_y + 1)) sides.push("bottom")
	return sides
}

function hasAgentAt(agents: AgentRow[], x: number, y: number): boolean {
	return agents.some((agent) => agent.layout_x === x && agent.layout_y === y)
}
