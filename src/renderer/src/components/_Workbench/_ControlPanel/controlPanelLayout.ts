import type { AgentRow } from "@renderer/types/models"

export const CARD_W = 1040
export const CARD_H = 680
export const GAP = 96
export const PADDING = 80
export const COLS = 2
export const MIN_ZOOM = 0.42
export const MAX_ZOOM = 1.15

export const PLACEHOLDER_AGENTS: AgentRow[] = [
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

export function canvasSize(count: number): { w: number; h: number } {
	const rows = Math.ceil(count / COLS)
	return {
		w: COLS * CARD_W + (COLS - 1) * GAP + PADDING * 2,
		h: rows * CARD_H + (rows - 1) * GAP + PADDING * 2
	}
}

export function cardPos(idx: number): { x: number; y: number } {
	return {
		x: PADDING + (idx % COLS) * (CARD_W + GAP),
		y: PADDING + Math.floor(idx / COLS) * (CARD_H + GAP)
	}
}

export function clampZoom(zoom: number): number {
	return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function clampOffset(
	offset: { x: number; y: number },
	viewport: { w: number; h: number },
	canvas: { w: number; h: number },
	zoom: number
): { x: number; y: number } {
	return {
		x: clampAxis(offset.x, viewport.w, canvas.w * zoom),
		y: clampAxis(offset.y, viewport.h, canvas.h * zoom)
	}
}

export function fitZoom(
	viewport: { w: number; h: number },
	canvas: { w: number; h: number }
): number {
	const availableW = Math.max(1, viewport.w - 96)
	const availableH = Math.max(1, viewport.h - 96)
	return clampZoom(Math.min(1, availableW / canvas.w, availableH / canvas.h))
}

export function centerOffset(
	center: { x: number; y: number },
	viewport: { w: number; h: number },
	canvas: { w: number; h: number },
	zoom: number
): { x: number; y: number } {
	return clampOffset(
		{
			x: viewport.w / 2 - center.x * zoom,
			y: viewport.h / 2 - center.y * zoom
		},
		viewport,
		canvas,
		zoom
	)
}

export function cardCenter(idx: number): { x: number; y: number } {
	const pos = cardPos(idx)
	return { x: pos.x + CARD_W / 2, y: pos.y + CARD_H / 2 }
}

export function nearestCardIndex(center: { x: number; y: number }, count: number): number {
	let nearest = 0
	let nearestDistance = Number.POSITIVE_INFINITY
	for (let i = 0; i < count; i += 1) {
		const card = cardCenter(i)
		const distance = Math.abs(card.x - center.x) + Math.abs(card.y - center.y)
		if (distance < nearestDistance) {
			nearest = i
			nearestDistance = distance
		}
	}
	return nearest
}

export function nearestCardInDirection(
	center: { x: number; y: number },
	count: number,
	direction: "left" | "right" | "up" | "down"
): number {
	let nearest = nearestCardIndex(center, count)
	let nearestDistance = Number.POSITIVE_INFINITY
	for (let i = 0; i < count; i += 1) {
		const card = cardCenter(i)
		const primaryDistance =
			direction === "left"
				? center.x - card.x
				: direction === "right"
					? card.x - center.x
					: direction === "up"
						? center.y - card.y
						: card.y - center.y
		if (primaryDistance <= 1) continue
		const crossDistance =
			direction === "left" || direction === "right"
				? Math.abs(card.y - center.y)
				: Math.abs(card.x - center.x)
		const distance = primaryDistance * 10000 + crossDistance
		if (distance < nearestDistance) {
			nearest = i
			nearestDistance = distance
		}
	}
	return nearest
}

export function canStartPan(target: EventTarget | null, forcePan: boolean): boolean {
	const element = target instanceof Element ? target : null
	const blocked = forcePan
		? "input, textarea, select, [contenteditable='true']"
		: "button, input, textarea, select, a, [contenteditable='true'], .nodrag"
	return !element?.closest(blocked)
}

export function canElementScroll(element: HTMLElement, deltaX: number, deltaY: number): boolean {
	if (Math.abs(deltaX) > Math.abs(deltaY)) {
		if (deltaX < 0) return element.scrollLeft > 0
		if (deltaX > 0) return element.scrollLeft + element.clientWidth < element.scrollWidth
		return false
	}
	if (deltaY < 0) return element.scrollTop > 0
	if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight
	return false
}

function clampAxis(offset: number, viewportSize: number, contentSize: number): number {
	if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2
	return Math.min(0, Math.max(offset, viewportSize - contentSize))
}
