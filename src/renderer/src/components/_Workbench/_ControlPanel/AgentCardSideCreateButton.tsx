import { useCallback, useRef } from "react"
import { Plus } from "lucide-react"
import { ProviderIcon } from "./ControlPanelAgentLauncher"
import type { StartAgentInput } from "./useControlPanelAgents"

export type CreateSide = "left" | "right" | "top" | "bottom"

const PROVIDERS: StartAgentInput[] = [{ provider: "codex" }, { provider: "claude" }]

export default function AgentCardSideCreateButton({
	active,
	onClose,
	onCreateAgent,
	onOpen,
	side,
	sourceAgentId
}: {
	active: boolean
	onClose: () => void
	onCreateAgent: (input: StartAgentInput) => Promise<void>
	onOpen: () => void
	side: CreateSide
	sourceAgentId: string
}) {
	const lightDismissCleanup = useRef<(() => void) | null>(null)
	const sideClass: Record<CreateSide, string> = {
		left: "left-[-62px] top-1/2 -translate-y-1/2",
		right: "right-[-62px] top-1/2 -translate-y-1/2",
		top: "left-1/2 top-[-62px] -translate-x-1/2",
		bottom: "bottom-[-62px] left-1/2 -translate-x-1/2"
	}
	const setPopoverRef = useCallback(
		(node: HTMLDivElement | null) => {
			lightDismissCleanup.current?.()
			lightDismissCleanup.current = null
			if (!node) return
			const popover = node

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
		[onClose]
	)

	return (
		<div className={`nodrag absolute z-40 ${sideClass[side]}`}>
			<button
				type="button"
				onClick={(event) => {
					event.preventDefault()
					event.stopPropagation()
					if (active) {
						onClose()
						return
					}
					onOpen()
				}}
				className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-neutral-400 opacity-35 transition-all duration-150 hover:scale-110 hover:text-white hover:opacity-100 group-hover/card:opacity-70"
				aria-label="Start another agent"
				title="Start another agent"
			>
				<Plus size={17} />
			</button>
			{active ? (
				<div
					ref={setPopoverRef}
					className="agent-create-popover absolute top-1/2 left-1/2 z-50 flex w-[120px] items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 p-2 shadow-2xl shadow-black/50"
					onClick={(event) => event.stopPropagation()}
				>
					{PROVIDERS.map((provider) => (
						<button
							key={provider.provider}
							type="button"
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								void onCreateAgent({
									...provider,
									sourceAgentId,
									side
								}).then(onClose)
							}}
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/8 bg-neutral-950 text-neutral-400 transition-colors duration-150 hover:border-white/15 hover:bg-white/8 hover:text-white"
							aria-label={`Start ${provider.provider} agent`}
							title={provider.provider}
						>
							<ProviderIcon provider={provider.provider} />
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}
