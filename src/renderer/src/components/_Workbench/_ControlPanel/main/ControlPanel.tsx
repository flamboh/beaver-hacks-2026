import { useRef, useState, useCallback, useEffect } from 'react'
import NavigationMap from '../NavigationMap'
import AgentCard from '../AgentCard'

const CANVAS_VW = 250
const CANVAS_VH = 250

function getCanvasSize() {
  return {
    w: (CANVAS_VW / 100) * window.innerWidth,
    h: (CANVAS_VH / 100) * window.innerHeight,
  }
}

function clamp(offset: { x: number; y: number }, vpW: number, vpH: number, scale: number) {
  const { w, h } = getCanvasSize()
  return {
    x: Math.min(0, Math.max(offset.x, vpW - w * scale)),
    y: Math.min(0, Math.max(offset.y, vpH - h * scale)),
  }
}

export default function ControlPanel() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
  const [showMap, setShowMap] = useState(false)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hideMapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashMap = useCallback(() => {
    setShowMap(true)
    if (hideMapTimer.current) clearTimeout(hideMapTimer.current)
    hideMapTimer.current = setTimeout(() => setShowMap(false), 2000)
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setVpSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setOffset(prev => {
      const vp = viewportRef.current
      const vpW = vp?.offsetWidth ?? 0
      const vpH = vp?.offsetHeight ?? 0
      return clamp({ x: prev.x + dx, y: prev.y + dy }, vpW, vpH, scale)
    })
    flashMap()
  }, [scale, flashMap])

  const onMouseUp = useCallback(() => { isPanning.current = false }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const vp = viewportRef.current
    if (!vp) return
    const vpW = vp.offsetWidth
    const vpH = vp.offsetHeight

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = -e.deltaY * 0.001
      setScale(prev => {
        const next = Math.min(Math.max(prev + delta * prev, 0.1), 4)
        // zoom toward cursor
        const rect = vp.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        setOffset(prevOffset => {
          const canvasX = (mouseX - prevOffset.x) / prev
          const canvasY = (mouseY - prevOffset.y) / prev
          return clamp(
            { x: mouseX - canvasX * next, y: mouseY - canvasY * next },
            vpW, vpH, next
          )
        })
        return next
      })
    } else {
      setOffset(prev =>
        clamp({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }, vpW, vpH, scale)
      )
    }
    flashMap()
  }, [scale, flashMap])

  const canvas = getCanvasSize()

  return (
    <div
      ref={viewportRef}
      className="w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing select-none bg-neutral-950"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* dot grid — tracks pan/zoom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff18 1px, transparent 1px)',
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${offset.x % (24 * scale)}px ${offset.y % (24 * scale)}px`,
        }}
      />

      {/* canvas */}
      <div
        style={{
          position: 'absolute',
          width: `${CANVAS_VW}vw`,
          height: `${CANVAS_VH}vh`,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <div className="absolute inset-0 border border-white/10 pointer-events-none" />
        {/* agent cards — positioned in canvas space */}
        <div className="absolute" style={{ left: 80, top: 80 }}>
          <AgentCard />
        </div>
      </div>

      <NavigationMap
        canvasWidth={canvas.w}
        canvasHeight={canvas.h}
        viewportWidth={vpSize.w}
        viewportHeight={vpSize.h}
        offset={offset}
        scale={scale}
        visible={showMap}
      />

      <div className="absolute bottom-3 right-3 text-xs text-neutral-500 pointer-events-none tabular-nums">
        {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
