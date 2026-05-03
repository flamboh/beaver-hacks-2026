import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { Globe, Terminal } from "lucide-react"
import { ProviderIcon } from "./ControlPanelAgentLauncher"
import type { CreateSide } from "./AgentCardSideCreateButton"
import type { StartAgentInput, StartCardInput, StartToolInput } from "./useControlPanelAgents"

const AGENT_OPTIONS: StartAgentInput[] = [
	{ kind: "agent", provider: "codex" },
	{ kind: "agent", provider: "claude" }
]
const TOOL_OPTIONS: StartToolInput[] = [
	{ kind: "tool", tool: "terminal" },
	{ kind: "tool", tool: "browser" }
]

interface CreateCardOptionsPopoverProps {
	anchor?: "center" | "topLeft"
	autoFocusFirst?: boolean
	className?: string
	onClose: () => void
	onCreateCard: (input: StartCardInput) => Promise<void>
	showAgents?: boolean
	side: CreateSide
	sourceCardId?: string
	style?: CSSProperties
}

export default function CreateCardOptionsPopover({
	anchor = "topLeft",
	autoFocusFirst = false,
	className,
	onClose,
	onCreateCard,
	showAgents = true,
	side,
	sourceCardId,
	style
}: CreateCardOptionsPopoverProps) {
	const lightDismissCleanup = useRef<(() => void) | null>(null)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const options: StartCardInput[] = showAgents ? [...AGENT_OPTIONS, ...TOOL_OPTIONS] : TOOL_OPTIONS
	const setPopoverRef = useCallback(
		(node: HTMLDivElement | null) => {
			lightDismissCleanup.current?.()
			lightDismissCleanup.current = null
			if (!node) return
			const popover = node
			if (autoFocusFirst) {
				window.requestAnimationFrame(() => {
					popover.querySelector<HTMLButtonElement>("button")?.focus()
				})
			}

			function handlePointerDown(event: PointerEvent): void {
				if (popover.contains(event.target as Node | null)) return
				lightDismissCleanup.current?.()
				lightDismissCleanup.current = null
				onClose()
			}

			const timer = window.setTimeout(() => {
				document.addEventListener("pointerdown", handlePointerDown, true)
			}, 0)
			lightDismissCleanup.current = () => {
				window.clearTimeout(timer)
				document.removeEventListener("pointerdown", handlePointerDown, true)
			}
		},
		[autoFocusFirst, onClose]
	)
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.key === "Escape") {
			event.preventDefault()
			onClose()
			return
		}
		const buttons = Array.from(
			event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-card-option]")
		)
		const activeIndex = buttons.findIndex((button) => button === document.activeElement)
		const currentIndex = activeIndex === -1 ? selectedIndex : activeIndex
		const focus = (index: number) => {
			event.preventDefault()
			const nextIndex = Math.max(0, Math.min(index, buttons.length - 1))
			setSelectedIndex(nextIndex)
			buttons[nextIndex]?.focus()
		}
		const adjacentIndex = (direction: "left" | "right" | "up" | "down"): number => {
			const columnCount = 2
			const rowCount = Math.ceil(buttons.length / columnCount)
			const row = Math.floor(currentIndex / columnCount)
			const column = currentIndex % columnCount
			if (direction === "left" || direction === "right") {
				const nextColumn = column === 0 ? 1 : 0
				const nextIndex = row * columnCount + nextColumn
				return nextIndex >= buttons.length ? currentIndex : nextIndex
			}
			const rowDelta = direction === "down" ? 1 : -1
			const nextRow = (row + rowDelta + rowCount) % rowCount
			const nextIndex = nextRow * columnCount + column
			return nextIndex >= buttons.length ? buttons.length - 1 : nextIndex
		}

		if (event.key === "ArrowLeft") {
			focus(adjacentIndex("left"))
			return
		}
		if (event.key === "ArrowRight") {
			focus(adjacentIndex("right"))
			return
		}
		if (event.key === "ArrowUp") {
			focus(adjacentIndex("up"))
			return
		}
		if (event.key === "ArrowDown") {
			focus(adjacentIndex("down"))
			return
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			buttons[currentIndex]?.click()
			return
		}
		if (event.key !== "Tab") return
		if (event.shiftKey && currentIndex <= 0) {
			event.preventDefault()
			buttons.at(-1)?.focus()
			return
		}
		if (!event.shiftKey && currentIndex === buttons.length - 1) {
			event.preventDefault()
			buttons[0]?.focus()
		}
	}
	const createCard = (option: StartCardInput): void => {
		void onCreateCard({
			...option,
			side,
			...(sourceCardId ? { sourceCardId } : {})
		}).then(onClose)
	}

	return (
		<div
			ref={setPopoverRef}
			className={`agent-create-popover ${anchor === "center" ? "agent-create-popover-center" : ""} z-50 flex w-[108px] flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-neutral-950/95 p-1.5 shadow-[0_16px_48px_-18px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-md ${className ?? ""}`}
			style={style}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={handleKeyDown}
		>
			<div className="grid grid-cols-2 gap-1.5">
				{options.map((option, index) => (
					<button
						key={option.kind === "agent" ? option.provider : option.tool}
						data-card-option
						type="button"
						tabIndex={index === selectedIndex ? 0 : -1}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
							createCard(option)
						}}
						onFocus={() => setSelectedIndex(index)}
						onPointerEnter={() => setSelectedIndex(index)}
						className={`flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none transition-[border-color,background-color,color,box-shadow,scale] duration-150 hover:border-white/12 hover:bg-white/[0.06] hover:text-white active:scale-[0.96] ${
							selectedIndex === index
								? "border-blue-400/45 bg-blue-500/10 text-white shadow-[0_0_0_2px_rgba(96,165,250,0.18)]"
								: "border-white/[0.06] bg-black/35 text-neutral-400"
						}`}
						aria-label={
							option.kind === "agent"
								? `Start ${option.provider} agent`
								: `Create ${option.tool} card`
						}
						title={option.kind === "agent" ? option.provider : option.tool}
					>
						{option.kind === "agent" ? (
							<ProviderIcon provider={option.provider} />
						) : option.tool === "terminal" ? (
							<Terminal size={18} />
						) : (
							<Globe size={18} />
						)}
					</button>
				))}
			</div>
		</div>
	)
}
