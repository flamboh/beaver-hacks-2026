import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import type { CreateSide } from "../AgentCardSideCreateButton"
import NavigationMap from "../NavigationMap"
import { CanvasControls } from "../CanvasControls"
import { ControlPanelCanvas } from "../ControlPanelCanvas"
import CreateCardOptionsPopover from "../CreateCardOptionsPopover"
import { useControlPanelAgents } from "../useControlPanelAgents"
import { useControlPanelKeyboard } from "../useControlPanelKeyboard"
import {
	PADDING,
	CARD_W,
	STEP_X,
	STEP_Y,
	canElementScroll,
	canStartPan,
	canvasSize,
	cardCenter,
	centerOffset,
	clampOffset,
	clampZoom,
	fitZoom,
	laneCardCenterY,
	nearestCardInDirection,
	nearestCardIndex
} from "../controlPanelLayout"
import type { ControlPanelCard, StartCardInput, WorkspaceLane } from "../useControlPanelAgents"

interface ControlPanelProps {
	activeWorkspaceId: string
	onWorkspaceActivate: (workspaceId: string) => void
	onWorkspaceCreate: (sourceWorkspaceId: string, side: "top" | "bottom") => void
	projectIds: string[]
	workspaces: WorkspaceLane[]
}

export default function ControlPanel({
	activeWorkspaceId,
	onWorkspaceActivate,
	onWorkspaceCreate,
	projectIds,
	workspaces
}: ControlPanelProps) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const resizeObserver = useRef<ResizeObserver | null>(null)
	const hideMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const smoothPanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const edgePanFrame = useRef<number | null>(null)
	const wheelPanFrame = useRef<number | null>(null)
	const wheelTargetOffset = useRef({ x: PADDING, y: PADDING })
	const lastCenteredWorkspace = useRef<string | null>(null)
	const isPanning = useRef(false)
	const spacePan = useRef(false)
	const draggedDuringPan = useRef(false)
	const lastPos = useRef({ x: 0, y: 0 })
	const edgePointer = useRef({ x: 0, y: 0 })
	const wheelFnRef = useRef<(e: WheelEvent) => void>(() => {})

	const [offset, setOffset] = useState({ x: PADDING, y: PADDING })
	const [zoom, setZoom] = useState(1)
	const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
	const [showMap, setShowMap] = useState(false)
	const [focusedIdx, setFocusedIdx] = useState(0)
	const [smoothPan, setSmoothPan] = useState(false)
	const [spacePanActive, setSpacePanActive] = useState(false)
	const [contextCreateMenu, setContextCreateMenu] = useState<{
		x: number
		y: number
		sourceCardId: string
		side: CreateSide
	} | null>(null)
	const { cards, createCard, deleteCard, deletingCardId, isCreatingCard, refetch } =
		useControlPanelAgents(projectIds, workspaces, activeWorkspaceId)
	const canvas = useMemo(() => canvasSize(cards, workspaces.length), [cards, workspaces.length])
	const hasCards = cards.length > 0
	const hasCanvas = workspaces.length > 0
	const viewportCenter = useCallback(
		(nextOffset: { x: number; y: number }, nextZoom: number) => ({
			x: (vpSize.w / 2 - nextOffset.x) / nextZoom,
			y: (vpSize.h / 2 - nextOffset.y) / nextZoom
		}),
		[vpSize.h, vpSize.w]
	)
	const flashMap = useCallback(() => {
		setShowMap(true)
		if (hideMapTimer.current) clearTimeout(hideMapTimer.current)
		hideMapTimer.current = setTimeout(() => setShowMap(false), 2000)
	}, [])

	const stopWheelPan = useCallback(() => {
		if (wheelPanFrame.current) cancelAnimationFrame(wheelPanFrame.current)
		wheelPanFrame.current = null
	}, [])
	const commitOffset = useCallback(
		(nextOffset: { x: number; y: number }, nextZoom = zoom, syncFocus = true) => {
			stopWheelPan()
			const clamped = clampOffset(nextOffset, vpSize, canvas, nextZoom)
			wheelTargetOffset.current = clamped
			setOffset(clamped)
			if (syncFocus && cards.length > 0) {
				setFocusedIdx(nearestCardIndex(viewportCenter(clamped, nextZoom), cards, canvas))
			}
			flashMap()
		},
		[cards, canvas, flashMap, stopWheelPan, viewportCenter, vpSize, zoom]
	)

	const setView = useCallback(
		(nextOffset: { x: number; y: number }, nextZoom: number, syncFocus = true) => {
			const clampedZoom = clampZoom(nextZoom)
			setZoom(clampedZoom)
			commitOffset(nextOffset, clampedZoom, syncFocus)
		},
		[commitOffset]
	)

	const stableWheelCapture = useCallback((e: WheelEvent) => {
		const targetNode = e.target
		const target =
			targetNode instanceof Element
				? targetNode
				: targetNode instanceof Node
					? targetNode.parentElement
					: null
		if (target?.closest(".terminal-wheel-zone")) return
		const scrollable = target?.closest(".nowheel")
		if (scrollable instanceof HTMLElement && canElementScroll(scrollable, e.deltaX, e.deltaY)) {
			return
		}
		e.preventDefault()
		wheelFnRef.current(e)
	}, [])

	const setViewportRef = useCallback(
		(el: HTMLDivElement | null) => {
			if (viewportRef.current) {
				viewportRef.current.removeEventListener("wheel", stableWheelCapture, true)
			}
			resizeObserver.current?.disconnect()
			viewportRef.current = el
			if (!el) return
			const ro = new ResizeObserver(([entry]) =>
				setVpSize({ w: entry.contentRect.width, h: entry.contentRect.height })
			)
			ro.observe(el)
			resizeObserver.current = ro
			el.addEventListener("wheel", stableWheelCapture, { capture: true, passive: false })
		},
		[stableWheelCapture]
	)

	const activateCardWorkspace = useCallback(
		(card: ControlPanelCard) => {
			if (card.workspace_id === activeWorkspaceId) return
			onWorkspaceActivate(card.workspace_id)
		},
		[activeWorkspaceId, onWorkspaceActivate]
	)

	const centerCard = useCallback(
		(idx: number) => {
			if (!viewportRef.current) return
			setSmoothPan(true)
			setFocusedIdx(idx)
			const card = cards[idx]
			if (!card) return
			activateCardWorkspace(card)
			commitOffset(centerOffset(cardCenter(card, canvas), vpSize, canvas, zoom), zoom, false)
			flashMap()
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		},
		[activateCardWorkspace, cards, canvas, commitOffset, flashMap, vpSize, zoom]
	)

	const snapToCard = useCallback(
		(idx: number) => centerCard(Math.max(0, Math.min(idx, cards.length - 1))),
		[cards.length, centerCard]
	)

	const centerWorkspaceLane = useCallback(
		(workspaceIndex: number) => {
			if (!viewportRef.current) return
			const workspace = workspaces[workspaceIndex]
			if (!workspace) return
			onWorkspaceActivate(workspace.id)
			const cardIdx = cards.findIndex((card) => card.workspace_id === workspace.id)
			if (cardIdx >= 0) {
				centerCard(cardIdx)
				return
			}
			setSmoothPan(true)
			const y = laneCardCenterY(workspaceIndex, canvas)
			commitOffset(centerOffset({ x: PADDING + CARD_W / 2, y }, vpSize, canvas, zoom), zoom, false)
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		},
		[cards, canvas, centerCard, commitOffset, onWorkspaceActivate, vpSize, workspaces, zoom]
	)

	useEffect(() => {
		if (!hasCanvas || vpSize.w === 0 || vpSize.h === 0) return
		if (lastCenteredWorkspace.current === activeWorkspaceId) return
		const idx = cards.findIndex((card) => card.workspace_id === activeWorkspaceId)
		const workspaceIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId)
		if (idx < 0 && workspaceIndex < 0) return
		lastCenteredWorkspace.current = activeWorkspaceId
		const frame = requestAnimationFrame(() => {
			if (idx >= 0) {
				centerCard(idx)
				return
			}
			setSmoothPan(true)
			const y = laneCardCenterY(workspaceIndex, canvas)
			commitOffset(centerOffset({ x: PADDING + CARD_W / 2, y }, vpSize, canvas, zoom), zoom, false)
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		})
		return () => cancelAnimationFrame(frame)
	}, [
		activeWorkspaceId,
		cards,
		canvas,
		centerCard,
		commitOffset,
		hasCanvas,
		vpSize,
		workspaces,
		zoom
	])

	const moveFocus = useCallback(
		(direction: "left" | "right" | "up" | "down") => {
			if ((direction === "up" || direction === "down") && workspaces.length > 0) {
				const workspaceIndex = workspaces.findIndex(
					(workspace) => workspace.id === activeWorkspaceId
				)
				const nextWorkspaceIndex =
					direction === "up"
						? Math.max(0, workspaceIndex - 1)
						: Math.min(workspaces.length - 1, workspaceIndex + 1)
				centerWorkspaceLane(nextWorkspaceIndex)
				return
			}
			if (!hasCards) return
			centerCard(nearestCardInDirection(viewportCenter(offset, zoom), cards, canvas, direction))
		},
		[
			activeWorkspaceId,
			cards,
			canvas,
			centerCard,
			centerWorkspaceLane,
			hasCards,
			offset,
			viewportCenter,
			workspaces,
			zoom
		]
	)

	const focusCard = useCallback(
		(idx: number) => {
			setFocusedIdx(idx)
			const card = cards[idx]
			if (card) activateCardWorkspace(card)
		},
		[activateCardWorkspace, cards]
	)

	useControlPanelKeyboard({
		centerFocused: () => centerCard(focusedIdx),
		focusedIdx,
		moveFocus,
		setSpacePanActive,
		snapToCard,
		spacePan
	})

	const panBy = useCallback(
		(dx: number, dy: number) => {
			stopWheelPan()
			setOffset((current) => {
				const clamped = clampOffset({ x: current.x + dx, y: current.y + dy }, vpSize, canvas, zoom)
				wheelTargetOffset.current = clamped
				if (cards.length > 0) {
					setFocusedIdx(nearestCardIndex(viewportCenter(clamped, zoom), cards, canvas))
				}
				return clamped
			})
			flashMap()
		},
		[cards, canvas, flashMap, stopWheelPan, viewportCenter, vpSize, zoom]
	)

	const smoothWheelPanBy = useCallback(
		(dx: number, dy: number) => {
			wheelTargetOffset.current = clampOffset(
				{ x: wheelTargetOffset.current.x + dx, y: wheelTargetOffset.current.y + dy },
				vpSize,
				canvas,
				zoom
			)
			flashMap()
			if (wheelPanFrame.current) return

			function tick() {
				let done = false
				setOffset((current) => {
					const target = wheelTargetOffset.current
					const next = {
						x: current.x + (target.x - current.x) * 0.24,
						y: current.y + (target.y - current.y) * 0.24
					}
					if (Math.abs(target.x - next.x) + Math.abs(target.y - next.y) < 0.5) {
						done = true
						next.x = target.x
						next.y = target.y
					}
					if (cards.length > 0) {
						setFocusedIdx(nearestCardIndex(viewportCenter(next, zoom), cards, canvas))
					}
					return next
				})
				if (done) {
					wheelPanFrame.current = null
					return
				}
				wheelPanFrame.current = requestAnimationFrame(tick)
			}

			wheelPanFrame.current = requestAnimationFrame(tick)
		},
		[cards, canvas, flashMap, viewportCenter, vpSize, zoom]
	)

	const stopEdgePan = useCallback(() => {
		if (edgePanFrame.current) cancelAnimationFrame(edgePanFrame.current)
		edgePanFrame.current = null
	}, [])

	const startEdgePan = useCallback(() => {
		function tick() {
			if (!isPanning.current) {
				stopEdgePan()
				return
			}
			const vp = viewportRef.current
			if (!vp) return
			const rect = vp.getBoundingClientRect()
			const edge = 56
			const maxSpeed = 18
			const left = Math.max(0, edge - (edgePointer.current.x - rect.left))
			const right = Math.max(0, edge - (rect.right - edgePointer.current.x))
			const top = Math.max(0, edge - (edgePointer.current.y - rect.top))
			const bottom = Math.max(0, edge - (rect.bottom - edgePointer.current.y))
			const vx = ((left - right) / edge) * maxSpeed
			const vy = ((top - bottom) / edge) * maxSpeed
			if (vx || vy) panBy(vx, vy)
			edgePanFrame.current = requestAnimationFrame(tick)
		}
		edgePanFrame.current = requestAnimationFrame(tick)
	}, [panBy, stopEdgePan])

	const onMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.button !== 0 && e.button !== 1) return
			setContextCreateMenu(null)
			if (!canStartPan(e.target, spacePan.current)) return
			isPanning.current = true
			draggedDuringPan.current = false
			lastPos.current = { x: e.clientX, y: e.clientY }
			edgePointer.current = { x: e.clientX, y: e.clientY }
			e.preventDefault()
			stopEdgePan()
			startEdgePan()
		},
		[startEdgePan, stopEdgePan]
	)

	const onMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!isPanning.current) return
			const dx = e.clientX - lastPos.current.x
			const dy = e.clientY - lastPos.current.y
			if (Math.abs(dx) + Math.abs(dy) > 1) draggedDuringPan.current = true
			lastPos.current = { x: e.clientX, y: e.clientY }
			edgePointer.current = { x: e.clientX, y: e.clientY }
			panBy(dx, dy)
		},
		[panBy]
	)

	const onMouseUp = useCallback(() => {
		isPanning.current = false
		stopEdgePan()
	}, [stopEdgePan])

	useEffect(() => {
		wheelFnRef.current = (e: WheelEvent) => {
			const vp = viewportRef.current
			if (!vp) return
			if (e.metaKey || e.ctrlKey) {
				const rect = vp.getBoundingClientRect()
				const nextZoom = clampZoom(zoom * (e.deltaY > 0 ? 0.92 : 1.08))
				const anchor = {
					x: (e.clientX - rect.left - offset.x) / zoom,
					y: (e.clientY - rect.top - offset.y) / zoom
				}
				setView(
					{
						x: e.clientX - rect.left - anchor.x * nextZoom,
						y: e.clientY - rect.top - anchor.y * nextZoom
					},
					nextZoom
				)
				return
			}
			const dx = e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
			const dy = e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) ? 0 : e.deltaY
			smoothWheelPanBy(-dx, -dy)
		}
	}, [offset.x, offset.y, setView, smoothWheelPanBy, zoom])

	const fitAll = useCallback(() => {
		const nextZoom = fitZoom(vpSize, canvas)
		setSmoothPan(true)
		setView(centerOffset({ x: canvas.w / 2, y: canvas.h / 2 }, vpSize, canvas, nextZoom), nextZoom)
		if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
		smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
	}, [canvas, setView, vpSize])

	const actualSize = useCallback(() => {
		const center = viewportCenter(offset, zoom)
		setSmoothPan(true)
		setView(centerOffset(center, vpSize, canvas, 1), 1)
		if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
		smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
	}, [canvas, offset, setView, viewportCenter, vpSize, zoom])

	const navigateToCanvasPoint = useCallback(
		(center: { x: number; y: number }) => {
			commitOffset(centerOffset(center, vpSize, canvas, zoom), zoom)
		},
		[canvas, commitOffset, vpSize, zoom]
	)
	const handleCreateCard = useCallback(
		async (input: StartCardInput) => {
			if (isCreatingCard) return
			const sourceCard = cards.find((card) => card.id === input.sourceCardId)
			if (sourceCard && (input.side === "top" || input.side === "bottom")) {
				onWorkspaceCreate(sourceCard.workspace_id, input.side)
				return
			}
			const nextX =
				sourceCard && input.side === "left"
					? sourceCard.layout_x - 1
					: sourceCard && input.side === "right"
						? sourceCard.layout_x + 1
						: sourceCard?.layout_x
			const nextY =
				sourceCard && input.side === "top"
					? sourceCard.layout_y - 1
					: sourceCard && input.side === "bottom"
						? sourceCard.layout_y + 1
						: sourceCard?.layout_y

			await createCard(input)

			if (nextX === undefined || nextY === undefined) return
			const dx = nextX < canvas.minX ? -STEP_X * zoom : 0
			const dy = nextY < canvas.minY ? -STEP_Y * zoom : 0
			if (!dx && !dy) return

			setOffset((current) => {
				const next = { x: current.x + dx, y: current.y + dy }
				wheelTargetOffset.current = next
				return next
			})
		},
		[cards, canvas.minX, canvas.minY, createCard, isCreatingCard, onWorkspaceCreate, zoom]
	)
	const handleCreateWorkspace = useCallback(
		(sourceCardId: string, side: "top" | "bottom") => {
			const sourceCard = cards.find((card) => card.id === sourceCardId)
			if (!sourceCard) return
			onWorkspaceCreate(sourceCard.workspace_id, side)
		},
		[cards, onWorkspaceCreate]
	)
	const handleDeleteCard = useCallback(
		async (id: string) => {
			const deletedCard = cards.find((card) => card.id === id)
			const remainingCards = cards.filter((card) => card.id !== id)
			const nextCard = deletedCard
				? nearestRemainingCard(deletedCard, remainingCards, canvas)
				: null
			const nextCanvas = canvasSize(remainingCards, workspaces.length)
			setSmoothPan(true)
			await deleteCard(id)
			if (nextCard) {
				const nextIdx = remainingCards.findIndex((card) => card.id === nextCard.id)
				setFocusedIdx(Math.max(0, nextIdx))
				activateCardWorkspace(nextCard)
				commitOffset(
					centerOffset(cardCenter(nextCard, nextCanvas), vpSize, nextCanvas, zoom),
					zoom,
					false
				)
			} else {
				setFocusedIdx(0)
			}
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		},
		[
			activateCardWorkspace,
			cards,
			canvas,
			commitOffset,
			deleteCard,
			vpSize,
			workspaces.length,
			zoom
		]
	)
	const handleViewportContextMenu = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!hasCards) return
			const targetNode = event.target
			const target =
				targetNode instanceof Element
					? targetNode
					: targetNode instanceof Node
						? targetNode.parentElement
						: null
			if (
				target?.closest(
					".group/card, .agent-create-popover, button, input, textarea, select, a, [contenteditable='true']"
				)
			) {
				return
			}
			event.preventDefault()
			event.stopPropagation()
			const sourceCard = cards[Math.max(0, Math.min(focusedIdx, cards.length - 1))] ?? cards[0]
			const vp = viewportRef.current
			if (!sourceCard || !vp) return
			const rect = vp.getBoundingClientRect()
			const preferredSide = sideFromViewportPoint(
				event.clientX - rect.left,
				event.clientY - rect.top,
				rect.width,
				rect.height
			)
			const side = resolveCreateSide(preferredSide, sourceCard, cards)
			if (!side) return
			const menuW = 120
			const menuH = 82
			const padding = 8
			setContextCreateMenu({
				x: Math.min(Math.max(event.clientX - rect.left, padding), rect.width - menuW - padding),
				y: Math.min(Math.max(event.clientY - rect.top, padding), rect.height - menuH - padding),
				sourceCardId: sourceCard.id,
				side
			})
		},
		[cards, focusedIdx, hasCards]
	)
	const isActualSize = Math.abs(zoom - 1) < 0.01

	return (
		<div
			ref={hasCanvas ? setViewportRef : undefined}
			className={`relative h-full w-full overflow-hidden select-none bg-neutral-950 focus:outline-none ${
				hasCanvas ? (spacePanActive ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing") : ""
			}`}
			onMouseDownCapture={hasCanvas ? onMouseDown : undefined}
			onMouseMoveCapture={hasCanvas ? onMouseMove : undefined}
			onMouseUpCapture={hasCanvas ? onMouseUp : undefined}
			onMouseLeave={hasCanvas ? onMouseUp : undefined}
			onContextMenu={hasCards ? handleViewportContextMenu : undefined}
		>
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage: "radial-gradient(circle, #ffffff18 1px, transparent 1px)",
					backgroundSize: "24px 24px",
					backgroundPosition: `${offset.x % 24}px ${offset.y % 24}px`
				}}
			/>
			<button
				onClick={refetch}
				className="nodrag absolute top-3 right-3 z-30 rounded-md p-1.5 text-neutral-600 transition-colors duration-150 hover:bg-white/5 hover:text-neutral-300"
				title="Refresh agents"
			>
				<RefreshCw size={13} />
			</button>
			{hasCanvas ? (
				<>
					<ControlPanelCanvas
						activeWorkspaceId={activeWorkspaceId}
						cards={cards}
						canvas={canvas}
						draggedDuringPan={draggedDuringPan}
						deletingCardId={deletingCardId}
						focusedIdx={focusedIdx}
						isCreatingCard={isCreatingCard}
						offset={offset}
						onCreateCard={handleCreateCard}
						onCreateWorkspace={handleCreateWorkspace}
						onDeleteCard={handleDeleteCard}
						onFocus={focusCard}
						onSnap={snapToCard}
						smoothPan={smoothPan}
						workspaces={workspaces}
						zoom={zoom}
					/>
					<NavigationMap
						canvasWidth={canvas.w}
						canvasHeight={canvas.h}
						viewportWidth={vpSize.w}
						viewportHeight={vpSize.h}
						offset={offset}
						scale={zoom}
						visible={showMap}
						onNavigate={navigateToCanvasPoint}
					/>
					<CanvasControls
						onCenterFocused={() => centerCard(focusedIdx)}
						onToggleFit={isActualSize ? fitAll : actualSize}
						showFitAll={isActualSize}
					/>
					<div className="pointer-events-none absolute right-3 bottom-3 select-none text-xs text-neutral-600">
						{cards.length} cards
					</div>
				</>
			) : null}
			{contextCreateMenu ? (
				<CreateCardOptionsPopover
					onClose={() => setContextCreateMenu(null)}
					onCreateCard={handleCreateCard}
					showAgents={false}
					side={contextCreateMenu.side}
					sourceCardId={contextCreateMenu.sourceCardId}
					className="nodrag absolute"
					style={{ left: contextCreateMenu.x, top: contextCreateMenu.y }}
				/>
			) : null}
		</div>
	)
}

const SIDE_DELTA: Record<CreateSide, { x: number; y: number }> = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	top: { x: 0, y: 0 },
	bottom: { x: 0, y: 0 }
}

const SIDE_PRIORITY: Record<CreateSide, CreateSide[]> = {
	left: ["left", "right"],
	right: ["right", "left"],
	top: ["left", "right"],
	bottom: ["right", "left"]
}

function sideFromViewportPoint(x: number, y: number, width: number, height: number): CreateSide {
	const dx = x - width / 2
	const dy = y - height / 2
	if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "right" : "left"
	return dy >= 0 ? "bottom" : "top"
}

function resolveCreateSide(
	preferredSide: CreateSide,
	sourceCard: ControlPanelCard,
	cards: ControlPanelCard[]
): CreateSide | null {
	for (const side of SIDE_PRIORITY[preferredSide]) {
		const delta = SIDE_DELTA[side]
		const nextX = sourceCard.layout_x + delta.x
		const nextY = sourceCard.layout_y + delta.y
		if (!cards.some((card) => card.layout_x === nextX && card.layout_y === nextY)) return side
	}
	return null
}

function nearestRemainingCard(
	deletedCard: ControlPanelCard,
	cards: ControlPanelCard[],
	layout: ReturnType<typeof canvasSize>
): ControlPanelCard | null {
	let nearest: ControlPanelCard | null = null
	let nearestDistance = Number.POSITIVE_INFINITY
	const deletedCenter = cardCenter(deletedCard, layout)
	for (const card of cards) {
		const center = cardCenter(card, layout)
		const distance = Math.abs(center.x - deletedCenter.x) + Math.abs(center.y - deletedCenter.y)
		if (distance < nearestDistance) {
			nearest = card
			nearestDistance = distance
		}
	}
	return nearest
}
