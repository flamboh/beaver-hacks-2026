import { useEffect } from "react"

interface UseControlPanelKeyboardProps {
	centerFocused: () => void
	focusedIdx: number
	moveFocus: (direction: "left" | "right" | "up" | "down") => void
	setSpacePanActive: (active: boolean) => void
	snapToCard: (idx: number) => void
	spacePan: { current: boolean }
}

export function useControlPanelKeyboard({
	centerFocused,
	focusedIdx,
	moveFocus,
	setSpacePanActive,
	snapToCard,
	spacePan
}: UseControlPanelKeyboardProps): void {
	useEffect(() => {
		const keyDown = (e: KeyboardEvent) => {
			const target = e.target as Element | null
			if (e.key === "Escape") {
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
				return
			}
			if (e.key === "Tab") {
				e.preventDefault()
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
				snapToCard(focusedIdx + (e.shiftKey ? -1 : 1))
				return
			}
			if (target?.closest("input, textarea, [contenteditable='true']")) return
			if (e.code === "Space") {
				spacePan.current = true
				setSpacePanActive(true)
				return
			}
			if (
				!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "h", "j", "k", "l", "Enter"].includes(
					e.key
				)
			) {
				return
			}
			e.preventDefault()
			if (e.key === "Enter") centerFocused()
			if (e.key === "ArrowRight" || e.key === "l") moveFocus("right")
			if (e.key === "ArrowLeft" || e.key === "h") moveFocus("left")
			if (e.key === "ArrowDown" || e.key === "j") moveFocus("down")
			if (e.key === "ArrowUp" || e.key === "k") moveFocus("up")
		}
		const keyUp = (e: KeyboardEvent) => {
			if (e.code !== "Space") return
			spacePan.current = false
			setSpacePanActive(false)
		}
		window.addEventListener("keydown", keyDown)
		window.addEventListener("keyup", keyUp)
		return () => {
			window.removeEventListener("keydown", keyDown)
			window.removeEventListener("keyup", keyUp)
		}
	}, [centerFocused, focusedIdx, moveFocus, setSpacePanActive, snapToCard, spacePan])
}
