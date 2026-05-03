import { useRef, useState, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import NavigationMap from "../NavigationMap"
import AgentCard from "../AgentCard"
import { useSessionData } from "@renderer/hooks/useSessionData"
import { LucideSquareArrowOutUpRight } from "lucide-react"

// ── layout constants ──────────────────────────────────────────────
const CARD_W = 1000
const CARD_H = 700
const GAP = 50
const PADDING = 50
const COLS = 3

// ── canvas math ───────────────────────────────────────────────────
function canvasSize(count: number) {
	const rows = Math.ceil(count / COLS)
	return {
		w: COLS * CARD_W + (COLS - 1) * GAP + PADDING * 2,
		h: rows * CARD_H + (rows - 1) * GAP + PADDING * 2
	}
}

function cardPos(idx: number) {
	return {
		x: PADDING + (idx % COLS) * (CARD_W + GAP),
		y: PADDING + Math.floor(idx / COLS) * (CARD_H + GAP)
	}
}

function clamp(offset: { x: number; y: number }, vpW: number, vpH: number, cW: number, cH: number) {
	return {
		x: Math.min(PADDING, Math.max(offset.x, vpW - cW)),
		y: Math.min(PADDING, Math.max(offset.y, vpH - cH))
	}
}

// ── component ─────────────────────────────────────────────────────
export default function ControlPanel() {
	const { project } = useSessionData()
	const projectId = project?.id ?? ""

	const { data: agents = [], refetch } = useQuery({
		queryKey: ["agents", projectId],
		queryFn: () => window.api.agents.list(projectId),
		enabled: !!projectId
	})

	const viewportRef = useRef<HTMLDivElement>(null)
	const resizeObserver = useRef<ResizeObserver | null>(null)
	const hideMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isPanning = useRef(false)
	const lastPos = useRef({ x: 0, y: 0 })
	const wheelFnRef = useRef<(e: WheelEvent) => void>(() => {})

	const [offset, setOffset] = useState({ x: PADDING, y: PADDING })
	const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
	const [showMap, setShowMap] = useState(false)
	const [focusedIdx, setFocusedIdx] = useState(0)
	const [smoothPan, setSmoothPan] = useState(false)

	const flashMap = useCallback(() => {
		setShowMap(true)
		if (hideMapTimer.current) clearTimeout(hideMapTimer.current)
		hideMapTimer.current = setTimeout(() => setShowMap(false), 2000)
	}, [])

	const stableWheelCapture = useCallback((e: WheelEvent) => {
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

	const snapToCard = useCallback(
		(idx: number) => {
			const clamped = Math.max(0, Math.min(idx, agents.length - 1))
			setFocusedIdx(clamped)

			const vp = viewportRef.current
			if (!vp) return
			const vpW = vp.offsetWidth
			const vpH = vp.offsetHeight
			const { w, h } = canvasSize(agents.length)
			const pos = cardPos(clamped)

			const tx = vpW / 2 - pos.x - CARD_W / 2
			const ty = vpH / 2 - pos.y + 20 - CARD_H / 2 + PADDING / 2

			setSmoothPan(true)
			setOffset(clamp({ x: tx, y: ty }, vpW, vpH, w, h))
			flashMap()
			setTimeout(() => setSmoothPan(false), 620)
		},
		[agents.length, flashMap]
	)

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
			e.preventDefault()
			if (e.key === "ArrowRight") snapToCard(focusedIdx + 1)
			if (e.key === "ArrowLeft") snapToCard(focusedIdx - 1)
			if (e.key === "ArrowDown") snapToCard(focusedIdx + COLS)
			if (e.key === "ArrowUp") snapToCard(focusedIdx - COLS)
		}
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [focusedIdx, snapToCard])

	const onMouseDown = useCallback((e: React.MouseEvent) => {
		const tag = (e.target as HTMLElement).tagName
		if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return
		isPanning.current = true
		lastPos.current = { x: e.clientX, y: e.clientY }
		e.preventDefault()
	}, [])

	const onMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!isPanning.current) return
			const dx = e.clientX - lastPos.current.x
			const dy = e.clientY - lastPos.current.y
			lastPos.current = { x: e.clientX, y: e.clientY }
			setOffset((prev) => {
				const vp = viewportRef.current
				const vpW = vp?.offsetWidth ?? 0
				const vpH = vp?.offsetHeight ?? 0
				const { w, h } = canvasSize(agents.length)
				return clamp({ x: prev.x + dx, y: prev.y + dy }, vpW, vpH, w, h)
			})
			flashMap()
		},
		[agents.length, flashMap]
	)

	const onMouseUp = useCallback(() => {
		isPanning.current = false
	}, [])

	useEffect(() => {
		wheelFnRef.current = (e: WheelEvent) => {
			const vp = viewportRef.current
			if (!vp) return
			const { w, h } = canvasSize(agents.length)
			setOffset((prev) =>
				clamp({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }, vp.offsetWidth, vp.offsetHeight, w, h)
			)
			flashMap()
		}
	}, [agents.length, flashMap])

	const canvas = canvasSize(agents.length)
	const hasAgents = agents.length > 0

	return (
		<div
			ref={hasAgents ? setViewportRef : undefined}
			className={`w-full h-full overflow-hidden relative select-none bg-neutral-950 focus:outline-none ${
				hasAgents ? "cursor-grab active:cursor-grabbing" : ""
			}`}
			onMouseDown={hasAgents ? onMouseDown : undefined}
			onMouseMove={hasAgents ? onMouseMove : undefined}
			onMouseUp={hasAgents ? onMouseUp : undefined}
			onMouseLeave={hasAgents ? onMouseUp : undefined}
		>
			{/* dot grid — always visible */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					backgroundImage: "radial-gradient(circle, #ffffff18 1px, transparent 1px)",
					backgroundSize: "24px 24px",
					backgroundPosition: `${offset.x % 24}px ${offset.y % 24}px`
				}}
			/>

			{/* refresh button */}
			<button
				onClick={() => refetch()}
				className="absolute top-3 right-3 p-1.5 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-colors duration-150 z-10"
				title="Refresh agents"
			>
				<RefreshCw size={13} />
			</button>

			{!hasAgents ? (
				<div className="flex flex-col items-center justify-center h-full pointer-events-none gap-y-2">
					<span className="text-sm text-neutral-600 text-[1.5rem]">No Agents Yet</span>
					<div className="flex gap-x-2 text-blue-200">
						<h1 className="text-center hover:underline z-10">Get started now</h1>
						<LucideSquareArrowOutUpRight />
					</div>
				</div>
			) : (
				<>
					{/* canvas */}
					<div
						style={{
							position: "absolute",
							width: canvas.w,
							height: canvas.h,
							transform: `translate(${offset.x}px, ${offset.y}px)`,
							transformOrigin: "0 0",
							willChange: "transform",
							transition: smoothPan ? "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)" : "none"
						}}
					>
						{agents.map((agent, i) => {
							const pos = cardPos(i)
							const focused = focusedIdx === i
							return (
								<div
									key={agent.id}
									className="absolute"
									style={{ left: pos.x, top: pos.y }}
									onClick={() => snapToCard(i)}
								>
									<div
										className={`rounded-xl transition-shadow duration-150 ${
											focused ? "ring-2 ring-white/20 ring-offset-4 ring-offset-neutral-950" : ""
										}`}
									>
										<AgentCard agent={agent} />
									</div>
								</div>
							)
						})}
					</div>

					<NavigationMap
						canvasWidth={canvas.w}
						canvasHeight={canvas.h}
						viewportWidth={vpSize.w}
						viewportHeight={vpSize.h}
						offset={offset}
						scale={1}
						visible={showMap}
					/>

					<div className="absolute bottom-3 left-3 text-xs text-neutral-600 pointer-events-none select-none">
						{agents.length} agents
					</div>
				</>
			)}
		</div>
	)
}
