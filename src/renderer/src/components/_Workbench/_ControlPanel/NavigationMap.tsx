const MAP_W = 160
const MAP_H = 90

interface Props {
  canvasWidth: number
  canvasHeight: number
  viewportWidth: number
  viewportHeight: number
  offset: { x: number; y: number }
  scale: number
  visible: boolean
}

export default function NavigationMap({ canvasWidth, canvasHeight, viewportWidth, viewportHeight, offset, scale, visible }: Props) {
  if (canvasWidth === 0 || canvasHeight === 0) return null

  const scaleX = MAP_W / canvasWidth
  const scaleY = MAP_H / canvasHeight

  // viewport position and size in canvas space, then mapped to minimap space
  const rectX = (-offset.x / scale) * scaleX
  const rectY = (-offset.y / scale) * scaleY
  const rectW = (viewportWidth / scale) * scaleX
  const rectH = (viewportHeight / scale) * scaleY

  // clamp so the indicator never renders outside the minimap
  const clampedX = Math.max(0, Math.min(rectX, MAP_W))
  const clampedY = Math.max(0, Math.min(rectY, MAP_H))
  const clampedW = Math.min(rectW, MAP_W - clampedX)
  const clampedH = Math.min(rectH, MAP_H - clampedY)

  return (
    <div
      className={`absolute top-3 right-3 rounded border border-white/10 bg-neutral-900/80 backdrop-blur-sm overflow-hidden pointer-events-none transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ width: MAP_W, height: MAP_H }}
    >
      {/* viewport window */}
      <div
        className="absolute border border-white/10 bg-white/5 rounded-sm"
        style={{
          left: clampedX,
          top: clampedY,
          width: clampedW,
          height: clampedH,
        }}
      />
    </div>
  )
}
