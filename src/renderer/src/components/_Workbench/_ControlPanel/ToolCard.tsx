import { useRef, useState } from "react"
import type { StartCardInput, ToolCard as ToolCardModel } from "./useControlPanelAgents"
import AgentCardSideCreateButton, { type CreateSide } from "./AgentCardSideCreateButton"
import { CARD_H, CARD_W } from "./controlPanelLayout"
import TerminalCard from "./TerminalCard"
import BrowserCard from "./BrowserCard"

const MIN_CARD_WIDTH = 640
const MAX_CARD_WIDTH = 2000

interface ToolCardProps {
	card: ToolCardModel
	availableCreateSides: CreateSide[]
	isDeleting: boolean
	onCreateCard: (input: StartCardInput) => Promise<void>
	onCreateWorkspace: (sourceCardId: string, side: "top" | "bottom") => void
	onDeleteCard: (id: string) => Promise<void>
	workspacePath: string
}

export default function ToolCard({
	card,
	availableCreateSides,
	isDeleting,
	onCreateCard,
	onCreateWorkspace,
	onDeleteCard,
	workspacePath
}: ToolCardProps) {
	const [activeCreateSide, setActiveCreateSide] = useState<CreateSide | null>(null)
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [cardWidth, setCardWidth] = useState(CARD_W)
	const resizePointerIdRef = useRef<number | null>(null)
	const resizeCleanupRef = useRef<(() => void) | null>(null)
	const resizeStartXRef = useRef(0)
	const resizeStartWidthRef = useRef(cardWidth)
	const isResizable = card.tool === "terminal"

	function handleResizeStart(event: React.PointerEvent<HTMLDivElement>): void {
		event.preventDefault()
		event.stopPropagation()
		resizeCleanupRef.current?.()
		const pointerId = event.pointerId
		resizePointerIdRef.current = pointerId
		resizeStartXRef.current = event.clientX
		resizeStartWidthRef.current = cardWidth
		event.currentTarget.setPointerCapture(pointerId)

		const handlePointerMove = (moveEvent: PointerEvent): void => {
			if (resizePointerIdRef.current !== moveEvent.pointerId) return
			const next = resizeStartWidthRef.current + (moveEvent.clientX - resizeStartXRef.current)
			setCardWidth(Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, next)))
		}

		const cleanup = (): void => {
			resizePointerIdRef.current = null
			window.removeEventListener("pointermove", handlePointerMove)
			window.removeEventListener("pointerup", handlePointerEnd)
			window.removeEventListener("pointercancel", handlePointerEnd)
			if (event.currentTarget.hasPointerCapture(pointerId)) {
				event.currentTarget.releasePointerCapture(pointerId)
			}
			resizeCleanupRef.current = null
		}

		const handlePointerEnd = (endEvent: PointerEvent): void => {
			if (endEvent.pointerId !== pointerId) return
			cleanup()
		}

		window.addEventListener("pointermove", handlePointerMove)
		window.addEventListener("pointerup", handlePointerEnd)
		window.addEventListener("pointercancel", handlePointerEnd)
		resizeCleanupRef.current = cleanup
	}

	function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>): void {
		if (resizePointerIdRef.current !== event.pointerId) return
		resizeCleanupRef.current?.()
	}

	return (
		<div
			className="group/card nodrag relative cursor-default text-white"
			style={{ width: cardWidth, height: CARD_H }}
			onWheel={(event) => event.stopPropagation()}
		>
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
			<div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/8 bg-neutral-900 shadow-2xl shadow-black/40">
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
						className={`min-w-20 cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
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
			</div>
			{isResizable ? (
				<div
					role="separator"
					aria-label="Resize terminal width"
					title="Drag to resize terminal width"
					onPointerDown={handleResizeStart}
					onPointerUp={handleResizeEnd}
					onPointerCancel={handleResizeEnd}
					className="nodrag absolute top-0 right-0 z-30 h-full w-3 translate-x-1/2 cursor-col-resize"
				/>
			) : null}
		</div>
	)
}
