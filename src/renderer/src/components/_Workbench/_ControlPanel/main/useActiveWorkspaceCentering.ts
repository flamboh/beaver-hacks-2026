import { useCallback, useRef, useSyncExternalStore } from "react"
import { CARD_W, PADDING, type CanvasLayout, clampOffset } from "../controlPanelLayout"

interface PositionedWorkspaceCard {
	layout_x: number
	layout_y: number
	workspace_id: string
	width?: number
	height?: number
}

interface UseActiveWorkspaceCenteringProps {
	activeWorkspaceId: string
	canvas: CanvasLayout
	centerCard: (index: number) => void
	commitOffset: (offset: { x: number; y: number }, zoom: number, syncFocus: boolean) => void
	hasCanvas: boolean
	setSmoothPan: (smooth: boolean) => void
	sizedCards: PositionedWorkspaceCard[]
	smoothPanTimer: { current: ReturnType<typeof setTimeout> | null }
	viewport: { w: number; h: number }
	workspaces: { id: string }[]
	zoom: number
}

export function useActiveWorkspaceCentering({
	activeWorkspaceId,
	canvas,
	centerCard,
	commitOffset,
	hasCanvas,
	setSmoothPan,
	sizedCards,
	smoothPanTimer,
	viewport,
	workspaces,
	zoom
}: UseActiveWorkspaceCenteringProps): void {
	const lastCenteredWorkspace = useRef<string | null>(null)

	const subscribe = useCallback(() => {
		if (!hasCanvas || viewport.w === 0 || viewport.h === 0) return () => undefined
		if (lastCenteredWorkspace.current === activeWorkspaceId) return () => undefined

		const cardIndex = sizedCards.findIndex((card) => card.workspace_id === activeWorkspaceId)
		const workspaceIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId)
		if (cardIndex < 0 && workspaceIndex < 0) return () => undefined

		lastCenteredWorkspace.current = activeWorkspaceId
		const frame = requestAnimationFrame(() => {
			if (cardIndex >= 0) {
				centerCard(cardIndex)
				return
			}

			setSmoothPan(true)
			commitOffset(
				laneAlignedPointOffset(PADDING + CARD_W / 2, workspaceIndex, canvas, viewport, zoom),
				zoom,
				false
			)
			if (smoothPanTimer.current) clearTimeout(smoothPanTimer.current)
			smoothPanTimer.current = setTimeout(() => setSmoothPan(false), 320)
		})

		return () => cancelAnimationFrame(frame)
	}, [
		activeWorkspaceId,
		canvas,
		centerCard,
		commitOffset,
		hasCanvas,
		setSmoothPan,
		sizedCards,
		smoothPanTimer,
		viewport,
		workspaces,
		zoom
	])
	const getSnapshot = useCallback(() => activeWorkspaceId, [activeWorkspaceId])

	useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function laneAlignedPointOffset(
	x: number,
	laneIndex: number,
	layout: CanvasLayout,
	viewport: { w: number; h: number },
	zoom: number
): { x: number; y: number } {
	const rowTop = layout.rowTops.get(laneIndex) ?? 0
	return clampOffset(
		{
			x: viewport.w / 2 - x * zoom,
			y: -rowTop * zoom
		},
		viewport,
		layout,
		zoom
	)
}
