export const CARD_W = 1040
export const CARD_H = 680
export const CARD_WIDTH_STEPS = [CARD_W * 0.5, CARD_W, CARD_W * 1.5, CARD_W * 2] as const
export const MIN_CARD_W = CARD_WIDTH_STEPS[0]
export const MAX_CARD_W = CARD_WIDTH_STEPS[CARD_WIDTH_STEPS.length - 1]
export const GAP = 96
export const PADDING = 80
export const LANE_LABEL_GUTTER = 72
export const COLS = 2
export const MIN_ZOOM = 0.42
export const MAX_ZOOM = 1.15
export const STEP_X = CARD_W + GAP
export const STEP_Y = CARD_H + LANE_LABEL_GUTTER + GAP

export interface CardSize {
	w: number
	h: number
}

export interface CanvasLayout {
	w: number
	h: number
	minX: number
	minY: number
	columnLefts: Map<number, number>
	cellLefts: Map<string, number>
	rowTops: Map<number, number>
	rowHeights: Map<number, number>
}

export interface PositionedCard {
	layout_x: number
	layout_y: number
	width?: number
	height?: number
}

export function canvasSize(cards: PositionedCard[], laneCount = 0): CanvasLayout {
	const emptyLayout = baseLayout(
		[0],
		Array.from({ length: Math.max(1, laneCount) }, (_, index) => index)
	)
	if (cards.length === 0) {
		return {
			...emptyLayout,
			w: CARD_W + PADDING * 2,
			h: layoutHeight(emptyLayout.rowHeights, emptyLayout.minY, Math.max(0, laneCount - 1))
		}
	}
	const xs = cards.map((card) => card.layout_x)
	const ys = cards.map((card) => card.layout_y)
	const minX = Math.min(...xs)
	const maxX = Math.max(...xs)
	const minY = Math.min(0, ...ys)
	const maxY = Math.max(laneCount - 1, ...ys)
	const xRange = range(minX, maxX)
	const yRange = range(minY, maxY)
	const layout = baseLayout(xRange, yRange)
	for (const x of xRange) {
		layout.columnLefts.set(
			x,
			PADDING +
				xRange
					.filter((candidate) => candidate < x)
					.reduce((sum, candidate) => sum + columnWidth(cards, candidate) + GAP, 0)
		)
	}
	for (const y of yRange) {
		for (const x of xRange) {
			layout.cellLefts.set(
				cellKey(x, y),
				PADDING +
					xRange
						.filter((candidate) => candidate < x)
						.reduce((sum, candidate) => sum + rowColumnWidth(cards, candidate, y) + GAP, 0)
			)
		}
	}
	for (const y of yRange) {
		layout.rowHeights.set(y, rowHeight(cards, y))
		layout.rowTops.set(
			y,
			PADDING +
				yRange
					.filter((candidate) => candidate < y)
					.reduce(
						(sum, candidate) =>
							sum + (layout.rowHeights.get(candidate) ?? CARD_H) + LANE_LABEL_GUTTER + GAP,
						0
					)
		)
	}
	return {
		...layout,
		w: Math.max(
			...yRange.map(
				(y) =>
					xRange.reduce((sum, x) => sum + rowColumnWidth(cards, x, y), 0) +
					(xRange.length - 1) * GAP +
					PADDING * 2
			)
		),
		h: layoutHeight(layout.rowHeights, minY, maxY)
	}
}

export function cardPos(card: PositionedCard, layout: CanvasLayout): { x: number; y: number } {
	return {
		x:
			layout.cellLefts.get(cellKey(card.layout_x, card.layout_y)) ??
			layout.columnLefts.get(card.layout_x) ??
			PADDING + (card.layout_x - layout.minX) * STEP_X,
		y:
			(layout.rowTops.get(card.layout_y) ?? PADDING + (card.layout_y - layout.minY) * STEP_Y) +
			LANE_LABEL_GUTTER
	}
}

export function laneCardCenterY(laneIndex: number, layout: CanvasLayout): number {
	const rowTop = layout.rowTops.get(laneIndex) ?? PADDING + (laneIndex - layout.minY) * STEP_Y
	const rowHeight = layout.rowHeights.get(laneIndex) ?? CARD_H
	return rowTop + LANE_LABEL_GUTTER + rowHeight / 2
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
	const size = cardSize(card)
	return { x: pos.x + size.w / 2, y: pos.y + size.h / 2 }
}

export function cardSize(card: PositionedCard): CardSize {
	return {
		w: clampCardWidth(card.width ?? CARD_W),
		h: CARD_H
	}
}

export function clampCardWidth(width: number): number {
	return Math.min(MAX_CARD_W, Math.max(MIN_CARD_W, width))
}

export function snapCardWidth(width: number): number {
	const clamped = clampCardWidth(width)
	return CARD_WIDTH_STEPS.reduce((nearest, step) =>
		Math.abs(step - clamped) < Math.abs(nearest - clamped) ? step : nearest
	)
}

export function nextCardWidthStep(width: number, direction: "grow" | "shrink"): number {
	const current = snapCardWidth(width)
	const index = CARD_WIDTH_STEPS.findIndex((step) => step === current)
	const nextIndex =
		direction === "grow" ? Math.min(CARD_WIDTH_STEPS.length - 1, index + 1) : Math.max(0, index - 1)
	return CARD_WIDTH_STEPS[nextIndex] ?? current
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

function baseLayout(xRange: number[], yRange: number[]): CanvasLayout {
	const minX = Math.min(...xRange)
	const minY = Math.min(...yRange)
	const rowHeights = new Map(yRange.map((y) => [y, CARD_H]))
	const rowTops = new Map(yRange.map((y) => [y, PADDING + (y - minY) * STEP_Y]))
	return {
		w: CARD_W + PADDING * 2,
		h: CARD_H + LANE_LABEL_GUTTER + PADDING * 2,
		minX,
		minY,
		columnLefts: new Map(xRange.map((x) => [x, PADDING + (x - minX) * STEP_X])),
		cellLefts: new Map(
			yRange.flatMap((y) => xRange.map((x) => [cellKey(x, y), PADDING + (x - minX) * STEP_X]))
		),
		rowTops,
		rowHeights
	}
}

function range(min: number, max: number): number[] {
	return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

function columnWidth(cards: PositionedCard[], x: number): number {
	const widths = cards.filter((card) => card.layout_x === x).map((card) => cardSize(card).w)
	return widths.length > 0 ? Math.max(...widths) : CARD_W
}

function rowColumnWidth(cards: PositionedCard[], x: number, y: number): number {
	const widths = cards
		.filter((card) => card.layout_x === x && card.layout_y === y)
		.map((card) => cardSize(card).w)
	return widths.length > 0 ? Math.max(...widths) : CARD_W
}

function rowHeight(cards: PositionedCard[], y: number): number {
	const heights = cards.filter((card) => card.layout_y === y).map((card) => cardSize(card).h)
	return heights.length > 0 ? Math.max(...heights) : CARD_H
}

function layoutHeight(rowHeights: Map<number, number>, minY: number, maxY: number): number {
	const rows = range(minY, maxY)
	return (
		rows.reduce((sum, y) => sum + (rowHeights.get(y) ?? CARD_H) + LANE_LABEL_GUTTER, 0) +
		(rows.length - 1) * GAP +
		PADDING * 2
	)
}

function cellKey(x: number, y: number): string {
	return `${x}:${y}`
}
