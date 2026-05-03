import { useCallback, useRef, type CSSProperties, type KeyboardEvent } from "react"
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
		const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"))
		const activeIndex = buttons.findIndex((button) => button === document.activeElement)
		const column = activeIndex % 2
		const row = Math.floor(activeIndex / 2)
		const rowCount = Math.ceil(buttons.length / 2)
		const close = (): void => {
			event.preventDefault()
			onClose()
		}

		if (event.key === "ArrowLeft") {
			if (column === 0) {
				close()
				return
			}
			event.preventDefault()
			buttons[activeIndex - 1]?.focus()
			return
		}
		if (event.key === "ArrowRight") {
			if (column === 1 || activeIndex === buttons.length - 1) {
				close()
				return
			}
			event.preventDefault()
			buttons[activeIndex + 1]?.focus()
			return
		}
		if (event.key === "ArrowUp") {
			if (row === 0) {
				close()
				return
			}
			event.preventDefault()
			buttons[activeIndex - 2]?.focus()
			return
		}
		if (event.key === "ArrowDown") {
			if (row === rowCount - 1 || activeIndex + 2 >= buttons.length) {
				close()
				return
			}
			event.preventDefault()
			buttons[activeIndex + 2]?.focus()
			return
		}
		if (event.key !== "Tab") return
		if (event.shiftKey && activeIndex <= 0) {
			event.preventDefault()
			buttons.at(-1)?.focus()
			return
		}
		if (!event.shiftKey && activeIndex === buttons.length - 1) {
			event.preventDefault()
			buttons[0]?.focus()
		}
	}

	return (
		<div
			ref={setPopoverRef}
			className={`agent-create-popover z-50 flex w-[120px] flex-col gap-2 rounded-lg border border-white/10 bg-neutral-900 p-2 shadow-2xl shadow-black/50 ${className ?? ""}`}
			style={style}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={handleKeyDown}
		>
			{showAgents ? (
				<div className="grid grid-cols-2 gap-2">
					{AGENT_OPTIONS.map((option) => (
						<button
							key={option.provider}
							type="button"
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								void onCreateCard({
									...option,
									side,
									...(sourceCardId ? { sourceCardId } : {})
								}).then(onClose)
							}}
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/8 bg-neutral-950 text-neutral-400 transition-colors duration-150 hover:border-white/15 hover:bg-white/8 hover:text-white"
							aria-label={`Start ${option.provider} agent`}
							title={option.provider}
						>
							<ProviderIcon provider={option.provider} />
						</button>
					))}
				</div>
			) : null}
			<div className={`grid grid-cols-2 gap-2 ${showAgents ? "border-t border-white/8 pt-2" : ""}`}>
				{TOOL_OPTIONS.map((option) => (
					<button
						key={option.tool}
						type="button"
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
							void onCreateCard({
								...option,
								side,
								...(sourceCardId ? { sourceCardId } : {})
							}).then(onClose)
						}}
						className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/8 bg-neutral-950 text-neutral-400 transition-colors duration-150 hover:border-white/15 hover:bg-white/8 hover:text-white"
						aria-label={`Create ${option.tool} card`}
						title={option.tool}
					>
						{option.tool === "terminal" ? <Terminal size={18} /> : <Globe size={18} />}
					</button>
				))}
			</div>
		</div>
	)
}
