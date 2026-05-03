import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import NavigationMap from "../NavigationMap"
import { CanvasControls } from "../CanvasControls"
import ControlPanelAgentLauncher from "../ControlPanelAgentLauncher"
import { ControlPanelCanvas } from "../ControlPanelCanvas"
import { useControlPanelAgents } from "../useControlPanelAgents"
import { useControlPanelKeyboard } from "../useControlPanelKeyboard"
import {
	PADDING,
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
	nearestCardInDirection,
	nearestCardIndex
} from "../controlPanelLayout"
import type { StartAgentInput } from "../useControlPanelAgents"

interface ControlPanelProps {
	workspaceId: string
	workspacePath: string
}

export default function ControlPanel({ workspaceId, workspacePath }: ControlPanelProps) {
	const viewportRef = useRef<HTMLDivElement>(null)
	const resizeObserver = useRef<ResizeObserver | null>(null)
	const hideMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const smoothPanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const edgePanFrame = useRef<number | null>(null)
	const wheelPanFrame = useRef<number | null>(null)
	const wheelTargetOffset = useRef({ x: PADDING, y: PADDING })
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
	const { agents, createAgent, deleteAgent, deletingAgentId, isCreatingAgent, refetch } =
		useControlPanelAgents(workspaceId, workspacePath)
	const canvas = useMemo(() => canvasSize(agents), [agents])
	const hasAgents = agents.length > 0
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
			if (syncFocus && agents.length > 0) {
				setFocusedIdx(nearestCardIndex(viewportCenter(clamped, nextZoom), agents, canvas))
			}
			flashMap()
		},
		[agents, canvas, flashMap, stopWheelPan, viewportCenter, vpSize, zoom]
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
		const target = e.target as Element | null
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

	const centerCard = useCallback(
		(idx: number) => {
			if (!viewportRef.current) return
			setSmoothPan(true)
			setFocusedIdx(idx)
			const agent = agents[idx]
			if (!agent) return
			commitOffset(centerOffset(cardCenter(agent, canvas), vpSize, canvas, zoom), zoom, false)
			flashMap()
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		},
		[agents, canvas, commitOffset, flashMap, vpSize, zoom]
	)

	const snapToCard = useCallback(
		(idx: number) => centerCard(Math.max(0, Math.min(idx, agents.length - 1))),
		[agents.length, centerCard]
	)

	const moveFocus = useCallback(
		(direction: "left" | "right" | "up" | "down") => {
			if (!hasAgents) return
			centerCard(nearestCardInDirection(viewportCenter(offset, zoom), agents, canvas, direction))
		},
		[agents, canvas, centerCard, hasAgents, offset, viewportCenter, zoom]
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
				if (agents.length > 0) {
					setFocusedIdx(nearestCardIndex(viewportCenter(clamped, zoom), agents, canvas))
				}
				return clamped
			})
			flashMap()
		},
		[agents, canvas, flashMap, stopWheelPan, viewportCenter, vpSize, zoom]
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
					if (agents.length > 0) {
						setFocusedIdx(nearestCardIndex(viewportCenter(next, zoom), agents, canvas))
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
		[agents, canvas, flashMap, viewportCenter, vpSize, zoom]
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
	const handleCreateAgent = useCallback(
		async (input: StartAgentInput) => {
			if (isCreatingAgent) return
			const sourceAgent = agents.find((agent) => agent.id === input.sourceAgentId)
			const nextX =
				sourceAgent && input.side === "left"
					? sourceAgent.layout_x - 1
					: sourceAgent && input.side === "right"
						? sourceAgent.layout_x + 1
						: sourceAgent?.layout_x
			const nextY =
				sourceAgent && input.side === "top"
					? sourceAgent.layout_y - 1
					: sourceAgent && input.side === "bottom"
						? sourceAgent.layout_y + 1
						: sourceAgent?.layout_y

			await createAgent(input)

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
		[agents, canvas.minX, canvas.minY, createAgent, isCreatingAgent, zoom]
	)
	const handleDeleteAgent = useCallback(
		async (id: string) => {
			setSmoothPan(true)
			await deleteAgent(id)
			setFocusedIdx((idx) => Math.max(0, Math.min(idx, agents.length - 2)))
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		},
		[agents.length, deleteAgent]
	)
	const isActualSize = Math.abs(zoom - 1) < 0.01

	return (
		<div
			ref={hasAgents ? setViewportRef : undefined}
			className={`relative h-full w-full overflow-hidden select-none bg-neutral-950 focus:outline-none ${
				hasAgents ? (spacePanActive ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing") : ""
			}`}
			onMouseDownCapture={hasAgents ? onMouseDown : undefined}
			onMouseMoveCapture={hasAgents ? onMouseMove : undefined}
			onMouseUpCapture={hasAgents ? onMouseUp : undefined}
			onMouseLeave={hasAgents ? onMouseUp : undefined}
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
				className="nodrag absolute top-3 right-3 z-10 rounded-md p-1.5 text-neutral-600 transition-colors duration-150 hover:bg-white/5 hover:text-neutral-300"
				title="Refresh agents"
			>
				<RefreshCw size={13} />
			</button>
			<ControlPanelAgentLauncher
				hasAgents={hasAgents}
				isCreatingAgent={isCreatingAgent}
				onCreateAgent={handleCreateAgent}
			/>
			{hasAgents ? (
				<>
					<ControlPanelCanvas
						agents={agents}
						canvas={canvas}
						draggedDuringPan={draggedDuringPan}
						deletingAgentId={deletingAgentId}
						focusedIdx={focusedIdx}
						offset={offset}
						onCreateAgent={handleCreateAgent}
						onDeleteAgent={handleDeleteAgent}
						onFocus={setFocusedIdx}
						onSnap={snapToCard}
						smoothPan={smoothPan}
						workspaceId={workspaceId}
						workspacePath={workspacePath}
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
						{agents.length} agents
					</div>
				</>
			) : null}
		</div>
	)
}
