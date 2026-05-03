import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import NavigationMap from "../NavigationMap"
import AgentCard from "../AgentCard"
import { useAgentSnapshot } from "@renderer/agentStore"
import { AgentRow } from "@renderer/types/models"

// ── layout constants ──────────────────────────────────────────────
const CARD_W = 1040
const CARD_H = 680
const GAP = 96
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

interface ControlPanelProps {
	workspacePath: string
}

// ── component ─────────────────────────────────────────────────────
export default function ControlPanel({ workspacePath }: ControlPanelProps) {
	const snapshot = useAgentSnapshot()
	const viewportRef = useRef<HTMLDivElement>(null)
	const resizeObserver = useRef<ResizeObserver | null>(null)
	const hideMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const smoothPanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isPanning = useRef(false)
	const lastPos = useRef({ x: 0, y: 0 })
	// always holds the latest wheel logic so the stable capture listener stays current
	const wheelFnRef = useRef<(e: WheelEvent) => void>(() => {})

	const [offset, setOffset] = useState({ x: PADDING, y: PADDING })
	const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
	const [showMap, setShowMap] = useState(false)
	const [focusedIdx, setFocusedIdx] = useState(0)
	const [smoothPan, setSmoothPan] = useState(false)
	const workspaceThreads = useMemo(
		() => snapshot.threads.filter((thread) => thread.cwd === workspacePath),
		[snapshot.threads, workspacePath]
	)
	const agents = useMemo<AgentRow[]>(
		() =>
			workspaceThreads.length > 0
				? workspaceThreads.map((thread) => ({
						id: thread.id,
						name: thread.title,
						project_id: "",
						model: thread.model ?? "codex",
						scope_path: thread.cwd,
						effort: "medium"
					}))
				: PLACEHOLDER_AGENTS,
		[workspaceThreads]
	)

	const flashMap = useCallback(() => {
		setShowMap(true)
		if (hideMapTimer.current) clearTimeout(hideMapTimer.current)
		hideMapTimer.current = setTimeout(() => setShowMap(false), 2000)
	}, [])

	// stable capture-phase handler — always delegates to the latest wheelFnRef
	const stableWheelCapture = useCallback((e: WheelEvent) => {
		const target = e.target as Element | null
		if (target?.closest(".nowheel")) return
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

	const centerCard = useCallback(
		(idx: number) => {
			const vp = viewportRef.current
			if (!vp) return
			const vpW = vp.offsetWidth
			const vpH = vp.offsetHeight
			const { w, h } = canvasSize(agents.length)
			const pos = cardPos(idx)

			// center the target card in the viewport
			const tx = vpW / 2 - pos.x - CARD_W / 2
			const ty = vpH / 2 - pos.y - CARD_H / 2

			setSmoothPan(true)
			setOffset(clamp({ x: tx, y: ty }, vpW, vpH, w, h))
			flashMap()
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		},
		[agents.length, flashMap]
	)

	const snapToCard = useCallback(
		(idx: number) => {
			const clamped = Math.max(0, Math.min(idx, agents.length - 1))
			setFocusedIdx(clamped)
			centerCard(clamped)
		},
		[agents.length, centerCard]
	)

	const moveFocus = useCallback(
		(direction: "left" | "right" | "up" | "down") => {
			if (agents.length === 0) return
			setFocusedIdx((current) => {
				const col = current % COLS
				let next = current
				if (direction === "left") next = col > 0 ? current - 1 : current
				if (direction === "right") {
					const right = current + 1
					next = col < COLS - 1 && right < agents.length ? right : current
				}
				if (direction === "up") next = current - COLS >= 0 ? current - COLS : current
				if (direction === "down") {
					const down = current + COLS
					next = down < agents.length && down % COLS === col ? down : current
				}
				centerCard(next)
				return next
			})
		},
		[agents.length, centerCard]
	)

	// keyboard grid-snap
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
			const target = e.target as Element | null
			if (target?.closest("input, textarea, [contenteditable='true']")) return
			e.preventDefault()
			if (e.key === "ArrowRight") moveFocus("right")
			if (e.key === "ArrowLeft") moveFocus("left")
			if (e.key === "ArrowDown") moveFocus("down")
			if (e.key === "ArrowUp") moveFocus("up")
		}
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [moveFocus])

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
								<AgentCard
									agent={agent}
									thread={workspaceThreads.find((thread) => thread.id === agent.id) ?? null}
									workspacePath={workspacePath}
								/>
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
