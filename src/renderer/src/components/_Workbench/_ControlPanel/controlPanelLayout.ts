export const CARD_W = 1040
export const CARD_H = 680
export const GAP = 96
export const PADDING = 80
export const LANE_LABEL_GUTTER = 48
export const COLS = 2
export const MIN_ZOOM = 0.42
export const MAX_ZOOM = 1.15
export const STEP_X = CARD_W + GAP
export const STEP_Y = CARD_H + LANE_LABEL_GUTTER + GAP

export interface CanvasLayout {
	w: number
	h: number
	minX: number
	minY: number
}

export interface PositionedCard {
	layout_x: number
	layout_y: number
}

export function canvasSize(cards: PositionedCard[], laneCount = 0): CanvasLayout {
	if (cards.length === 0) {
		return {
			w: CARD_W + PADDING * 2,
			h:
				Math.max(1, laneCount) * (CARD_H + LANE_LABEL_GUTTER) +
				Math.max(0, laneCount - 1) * GAP +
				PADDING * 2,
			minX: 0,
			minY: 0
		}
	}
	const xs = cards.map((card) => card.layout_x)
	const ys = cards.map((card) => card.layout_y)
	const minX = Math.min(...xs)
	const maxX = Math.max(...xs)
	const minY = Math.min(0, ...ys)
	const maxY = Math.max(laneCount - 1, ...ys)
	return {
		w: (maxX - minX + 1) * CARD_W + (maxX - minX) * GAP + PADDING * 2,
		h: (maxY - minY + 1) * (CARD_H + LANE_LABEL_GUTTER) + (maxY - minY) * GAP + PADDING * 2,
		minX,
		minY
	}
}

export function cardPos(card: PositionedCard, layout: CanvasLayout): { x: number; y: number } {
	return {
		x: PADDING + (card.layout_x - layout.minX) * STEP_X,
		y: PADDING + LANE_LABEL_GUTTER + (card.layout_y - layout.minY) * STEP_Y
	}
}

export function laneCardCenterY(laneIndex: number, layout: CanvasLayout): number {
	return PADDING + LANE_LABEL_GUTTER + (laneIndex - layout.minY) * STEP_Y + CARD_H / 2
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

export function cardCenter(card: PositionedCard, layout: CanvasLayout): { x: number; y: number } {
	const pos = cardPos(card, layout)
	return { x: pos.x + CARD_W / 2, y: pos.y + CARD_H / 2 }
}

export function nearestCardIndex(
	center: { x: number; y: number },
	cards: PositionedCard[],
	layout: CanvasLayout
): number {
	let nearest = 0
	let nearestDistance = Number.POSITIVE_INFINITY
	for (let i = 0; i < cards.length; i += 1) {
		const card = cardCenter(cards[i], layout)
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
	cards: PositionedCard[],
	layout: CanvasLayout,
	direction: "left" | "right" | "up" | "down"
): number {
	let nearest = nearestCardIndex(center, cards, layout)
	let nearestDistance = Number.POSITIVE_INFINITY
	for (let i = 0; i < cards.length; i += 1) {
		const card = cardCenter(cards[i], layout)
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
	const canScrollX =
		(deltaX < 0 && element.scrollLeft > 0) ||
		(deltaX > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth)
	const canScrollY =
		(deltaY < 0 && element.scrollTop > 0) ||
		(deltaY > 0 && element.scrollTop + element.clientHeight < element.scrollHeight)
	if (Math.abs(deltaX) > Math.abs(deltaY)) return canScrollX || canScrollY
	return canScrollY || canScrollX
}

function clampAxis(offset: number, viewportSize: number, contentSize: number): number {
	if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2
	return Math.min(0, Math.max(offset, viewportSize - contentSize))
}
