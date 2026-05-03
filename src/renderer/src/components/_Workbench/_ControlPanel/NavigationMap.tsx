import type { PointerEvent } from "react"

const MAP_W = 160
const MAP_H = 90
const MAP_PAD = 8

interface Props {
	canvasWidth: number
	canvasHeight: number
	viewportWidth: number
	viewportHeight: number
	offset: { x: number; y: number }
	onNavigate: (center: { x: number; y: number }) => void
	scale: number
	visible: boolean
}

export default function NavigationMap({
	canvasWidth,
	canvasHeight,
	viewportWidth,
	viewportHeight,
	offset,
	onNavigate,
	scale,
	visible
}: Props) {
	if (canvasWidth === 0 || canvasHeight === 0) return null

	const innerW = MAP_W - MAP_PAD * 2
	const innerH = MAP_H - MAP_PAD * 2
	const mapScale = Math.min(innerW / canvasWidth, innerH / canvasHeight)
	const mapW = canvasWidth * mapScale
	const mapH = canvasHeight * mapScale
	const mapX = (MAP_W - mapW) / 2
	const mapY = (MAP_H - mapH) / 2

	const visibleLeft = Math.max(0, -offset.x / scale)
	const visibleTop = Math.max(0, -offset.y / scale)
	const visibleRight = Math.min(canvasWidth, (viewportWidth - offset.x) / scale)
	const visibleBottom = Math.min(canvasHeight, (viewportHeight - offset.y) / scale)
	const rectX = mapX + visibleLeft * mapScale
	const rectY = mapY + visibleTop * mapScale
	const rectW = Math.max(0, (visibleRight - visibleLeft) * mapScale)
	const rectH = Math.max(0, (visibleBottom - visibleTop) * mapScale)
	const navigate = (event: PointerEvent<HTMLDivElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect()
		const x = Math.max(mapX, Math.min(event.clientX - bounds.left, mapX + mapW))
		const y = Math.max(mapY, Math.min(event.clientY - bounds.top, mapY + mapH))
		onNavigate({
			x: (x - mapX) / mapScale,
			y: (y - mapY) / mapScale
		})
	}
	const startDrag = (event: PointerEvent<HTMLDivElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId)
		navigate(event)
	}
	const drag = (event: PointerEvent<HTMLDivElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
		navigate(event)
	}

	return (
		<div
			onPointerDown={startDrag}
			onPointerMove={drag}
			className={`nodrag absolute top-3 right-3 cursor-crosshair overflow-hidden rounded border border-white/10 bg-neutral-900/80 backdrop-blur-sm transition-opacity duration-300 hover:opacity-100 ${visible ? "opacity-100" : "opacity-65"}`}
			style={{ width: MAP_W, height: MAP_H }}
		>
			<div
				className="absolute rounded-sm border border-white/8 bg-white/[0.02]"
				style={{
					left: mapX,
					top: mapY,
					width: mapW,
					height: mapH
				}}
			/>
			{/* viewport window */}
			<div
				className="absolute rounded-sm border border-white/20 bg-white/10"
				style={{
					left: rectX,
					top: rectY,
					width: rectW,
					height: rectH
				}}
			/>
		</div>
	)
}
