import AgentCard from "./AgentCard"
import type { AgentRow } from "@renderer/types/models"
import { cardPos } from "./controlPanelLayout"

interface ControlPanelCanvasProps {
	agents: AgentRow[]
	canvas: { w: number; h: number }
	draggedDuringPan: { current: boolean }
	focusedIdx: number
	offset: { x: number; y: number }
	onFocus: (idx: number) => void
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
			{agents.map((agent, i) => {
				const pos = cardPos(i)
				const focused = focusedIdx === i
				return (
					<div
						key={agent.id}
						className="absolute"
						style={{ left: pos.x, top: pos.y }}
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
							<AgentCard agent={agent} workspaceId={workspaceId} workspacePath={workspacePath} />
						</div>
					</div>
				)
			})}
		</div>
	)
}
