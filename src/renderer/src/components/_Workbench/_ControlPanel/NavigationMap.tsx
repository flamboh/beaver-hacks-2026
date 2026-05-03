import type { PointerEvent } from "react"
import { Globe, Terminal } from "lucide-react"
import { cardPos, cardSize, type CanvasLayout } from "./controlPanelLayout"
import type { ControlPanelCard } from "./useControlPanelAgents"

const MAP_W = 260
const MAP_H = 150
const MAP_PAD = 8
const MARKER_SIZE = 16

interface Props {
	canvasWidth: number
	canvasHeight: number
	cards: ControlPanelCard[]
	canvas: CanvasLayout
	viewportWidth: number
	viewportHeight: number
	offset: { x: number; y: number }
	onNavigate: (center: { x: number; y: number }) => void
	placement?: "canvas" | "sidebar"
	scale: number
	visible: boolean
}

export default function NavigationMap({
	canvasWidth,
	canvasHeight,
	cards,
	canvas,
	viewportWidth,
	viewportHeight,
	offset,
	onNavigate,
	placement = "canvas",
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

	const containerClass =
		placement === "canvas"
			? `nodrag absolute top-3 right-3 cursor-crosshair overflow-hidden rounded border border-white/10 bg-neutral-900/80 backdrop-blur-sm transition-opacity duration-300 hover:opacity-100 ${visible ? "opacity-100" : "opacity-65"}`
			: "nodrag relative cursor-crosshair overflow-hidden rounded-md border border-white/10 bg-neutral-950/70 shadow-sm shadow-black/30"

	return (
		<div
			onPointerDown={startDrag}
			onPointerMove={drag}
			className={containerClass}
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
			{cards.map((card) => {
				const pos = cardPos(card, canvas)
				const size = cardSize(card)
				const cardX = mapX + pos.x * mapScale
				const cardY = mapY + pos.y * mapScale
				const cardW = Math.max(4, size.w * mapScale)
				const cardH = Math.max(4, size.h * mapScale)

				return (
					<div
						key={card.id}
						className="pointer-events-none absolute rounded-[2px] border border-white/10 bg-neutral-800/80 transition-[left,width] duration-200 ease-out"
						style={{
							left: cardX,
							top: cardY,
							width: cardW,
							height: cardH
						}}
					>
						<div
							className="absolute flex items-center justify-center rounded-full border border-white/15 bg-neutral-950/95 text-neutral-300 shadow-sm shadow-black/50"
							style={{
								left: cardW / 2,
								top: cardH / 2,
								width: MARKER_SIZE,
								height: MARKER_SIZE,
								transform: "translate(-50%, -50%)"
							}}
						>
							<MapCardIcon card={card} />
						</div>
					</div>
				)
			})}
			{/* viewport window */}
			<div
				className="pointer-events-none absolute rounded-sm border border-white/25 bg-white/10"
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

function MapCardIcon({ card }: { card: ControlPanelCard }) {
	if (card.kind === "tool") {
		return card.tool === "terminal" ? <Terminal size={9} /> : <Globe size={9} />
	}

	if (card.provider === "claude") {
		return (
			<svg role="img" aria-label="Claude" viewBox="0 0 24 24" className="h-2.5 w-2.5">
				<path
					clipRule="evenodd"
					d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
					fill="#D97757"
					fillRule="evenodd"
				/>
			</svg>
		)
	}

	return (
		<svg role="img" aria-label="OpenAI" viewBox="0 0 24 24" className="h-2.5 w-2.5">
			<path
				d="M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z"
				fill="#9aa7ff"
			/>
		</svg>
	)
}
