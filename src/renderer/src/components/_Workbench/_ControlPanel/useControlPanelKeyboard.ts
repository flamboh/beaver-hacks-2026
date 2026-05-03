import { useEffect } from "react"

interface UseControlPanelKeyboardProps {
	centerFocused: () => void
	enterFocusedTyping: () => void
	focusedIdx: number
	moveFocus: (direction: "left" | "right" | "up" | "down") => void
	moveFocusedWithinRail: (direction: "left" | "right") => void
	onSpace: () => boolean
	onWorkspaceHotkey: (index: number) => void
	resizeFocused: (direction: "grow" | "shrink") => void
	setSpacePanActive: (active: boolean) => void
	snapToCard: (idx: number) => void
	spacePan: { current: boolean }
	toggleZoom: () => void
}

export function useControlPanelKeyboard({
	centerFocused,
	enterFocusedTyping,
	focusedIdx,
	moveFocus,
	moveFocusedWithinRail,
	onSpace,
	onWorkspaceHotkey,
	resizeFocused,
	setSpacePanActive,
	snapToCard,
	spacePan,
	toggleZoom
}: UseControlPanelKeyboardProps): void {
	useEffect(() => {
		const keyDown = (e: KeyboardEvent) => {
			const target = e.target as Element | null
			if (e.key === "Escape") {
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
				return
			}
			if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey && /^[1-9]$/.test(e.key)) {
				e.preventDefault()
				onWorkspaceHotkey(Number(e.key) - 1)
				return
			}
			if (target?.closest(".agent-create-popover")) return
			if (target?.closest("input, textarea, [contenteditable='true']")) return
			if (e.altKey && e.code === "KeyZ") {
				e.preventDefault()
				toggleZoom()
				return
			}
			if (e.code === "Space") {
				if (onSpace()) {
					e.preventDefault()
					return
				}
				spacePan.current = true
				setSpacePanActive(true)
				return
			}
			if (e.key === "Tab") {
				e.preventDefault()
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
				snapToCard(focusedIdx + (e.shiftKey ? -1 : 1))
				return
			}
			if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
				e.preventDefault()
				resizeFocused(e.key === "ArrowRight" ? "grow" : "shrink")
				return
			}
			if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
				e.preventDefault()
				moveFocusedWithinRail(e.key === "ArrowRight" ? "right" : "left")
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
			if (e.key === "Enter") enterFocusedTyping()
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
	}, [
		centerFocused,
		enterFocusedTyping,
		focusedIdx,
		moveFocus,
		moveFocusedWithinRail,
		onSpace,
		onWorkspaceHotkey,
		resizeFocused,
		setSpacePanActive,
		snapToCard,
		spacePan,
		toggleZoom
	])
}
