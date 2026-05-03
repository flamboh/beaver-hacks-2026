import { useRef, useState, useCallback, useEffect } from "react"
import NavigationMap from "../NavigationMap"
import AgentCard from "../AgentCard"
import { AgentRow } from "@renderer/types/models"

// ── layout constants ──────────────────────────────────────────────
const CARD_W = 820
const CARD_H = 500
const GAP = 80
const PADDING = 80
const COLS = 2

// ── placeholder agents ────────────────────────────────────────────
const PLACEHOLDER_AGENTS: AgentRow[] = [
	{
		id: "1",
		name: "Auth Refactor",
		project_id: "proj-1",
		model: "claude-opus-4-7",
		scope_path: "@Pipeline.md",
		effort: "high"
	},
	{
		id: "2",
		name: "Test Coverage",
		project_id: "proj-1",
		model: "gpt-4o-mini",
		scope_path: "@tests/README.md",
		effort: "medium"
	},
	{
		id: "3",
		name: "Docs Generator",
		project_id: "proj-1",
		model: "claude-sonnet-4-6",
		scope_path: "",
		effort: "low"
	},
	{
		id: "4",
		name: "Lint Fixer",
		project_id: "proj-1",
		model: "gpt-4o",
		scope_path: "@.eslintrc.md",
		effort: "low"
	},
	{
		id: "5",
		name: "Schema Migrator",
		project_id: "proj-1",
		model: "claude-haiku-4-5",
		scope_path: "@schema.md",
		effort: "medium"
	},
	{
		id: "6",
		name: "CI Optimizer",
		project_id: "proj-1",
		model: "o3",
		scope_path: "",
		effort: "high"
	}
]

// placeholder query — replace with real IPC/DB call
async function fetchAgents(_projectId: string): Promise<AgentRow[]> {
	console.log(_projectId)
	return PLACEHOLDER_AGENTS
}

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
		x: Math.min(0, Math.max(offset.x, vpW - cW)),
		y: Math.min(0, Math.max(offset.y, vpH - cH))
	}
}

// ── component ─────────────────────────────────────────────────────
export default function ControlPanel() {
	const viewportRef = useRef<HTMLDivElement>(null)
	const resizeObserver = useRef<ResizeObserver | null>(null)
	const hideMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isPanning = useRef(false)
	const lastPos = useRef({ x: 0, y: 0 })
	// always holds the latest wheel logic so the stable capture listener stays current
	const wheelFnRef = useRef<(e: WheelEvent) => void>(() => {})

	const [agents, setAgents] = useState<AgentRow[]>([])
	const [offset, setOffset] = useState({ x: PADDING, y: PADDING })
	const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
	const [showMap, setShowMap] = useState(false)
	const [focusedIdx, setFocusedIdx] = useState(0)
	const [smoothPan, setSmoothPan] = useState(false)

	// fetch agents on mount
	useEffect(() => {
		fetchAgents("proj-1").then(setAgents)
	}, [])

	const flashMap = useCallback(() => {
		setShowMap(true)
		if (hideMapTimer.current) clearTimeout(hideMapTimer.current)
		hideMapTimer.current = setTimeout(() => setShowMap(false), 2000)
	}, [])

	// stable capture-phase handler — always delegates to the latest wheelFnRef
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
			// capture phase intercepts scroll even when cursor is over a child with overflow-auto
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

			// center the target card in the viewport
			const tx = vpW / 2 - pos.x - CARD_W / 2
			const ty = vpH / 2 - pos.y - CARD_H / 2

			setSmoothPan(true)
			setOffset(clamp({ x: tx, y: ty }, vpW, vpH, w, h))
			flashMap()
			setTimeout(() => setSmoothPan(false), 320)
		},
		[agents.length, flashMap]
	)

	// keyboard grid-snap
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

	// keep wheelFnRef current after each render — captured by the stable listener above
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

	return (
		<div
			ref={setViewportRef}
			className="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing select-none bg-neutral-950 focus:outline-none"
			onMouseDown={onMouseDown}
			onMouseMove={onMouseMove}
			onMouseUp={onMouseUp}
			onMouseLeave={onMouseUp}
		>
			{/* dot grid — tracks pan offset */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					backgroundImage: "radial-gradient(circle, #ffffff18 1px, transparent 1px)",
					backgroundSize: "24px 24px",
					backgroundPosition: `${offset.x % 24}px ${offset.y % 24}px`
				}}
			/>

			{/* canvas */}
			<div
				style={{
					position: "absolute",
					width: canvas.w,
					height: canvas.h,
					transform: `translate(${offset.x}px, ${offset.y}px)`,
					transformOrigin: "0 0",
					willChange: "transform",
					transition: smoothPan ? "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)" : "none"
				}}
			>
				{/* canvas boundary */}
				<div className="absolute inset-0 border border-white/10 pointer-events-none rounded-sm" />

				{/* agent cards */}
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
								<AgentCard />
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
		</div>
	)
}
