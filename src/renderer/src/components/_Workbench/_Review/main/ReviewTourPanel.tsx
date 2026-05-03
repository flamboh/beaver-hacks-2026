import { AlertCircle, LoaderCircle, Map, RefreshCw } from "lucide-react"
import type { PointerEvent, ReactNode } from "react"
import { useRef } from "react"
import { AnimatePresence, motion } from "motion/react"

interface ReviewTourPanelProps {
	canGenerate: boolean
	error: string | null
	generating: boolean
	height: number
	onGenerate: () => void
	onHeightChange: (height: number) => void
	stale: boolean
	tour: string
}

const MIN_HEIGHT = 52
const MAX_HEIGHT = 440

function clampHeight(height: number): number {
	return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height))
}

function renderBoldSpans(text: string): ReactNode[] {
	return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) =>
		segment.startsWith("**") && segment.endsWith("**") ? (
			<strong key={index} className="font-semibold text-neutral-100">
				{segment.slice(2, -2)}
			</strong>
		) : (
			segment
		)
	)
}

export function ReviewTourPanel({
	canGenerate,
	error,
	generating,
	height,
	onGenerate,
	onHeightChange,
	stale,
	tour
}: ReviewTourPanelProps) {
	const resizeStart = useRef({ height: MIN_HEIGHT, y: 0 })
	const hasBody = Boolean(tour || error)
	const hasTour = Boolean(tour)
	const hasStarted = hasBody || generating

	const startResize = (event: PointerEvent<HTMLDivElement>) => {
		resizeStart.current = { height, y: event.clientY }
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const resize = (event: PointerEvent<HTMLDivElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
		const delta = resizeStart.current.y - event.clientY
		onHeightChange(clampHeight(resizeStart.current.height + delta))
	}

	return (
		<section
			className="mt-4 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-neutral-950 transition-[height,border-color,background-color] duration-200 ease-out"
			style={{ height: clampHeight(height) }}
		>
			<div
				role="separator"
				aria-orientation="horizontal"
				onPointerDown={startResize}
				onPointerMove={resize}
				className="flex h-2 cursor-ns-resize items-center justify-center border-b border-white/5 bg-white/[0.02]"
			>
				<div className="h-px w-10 rounded-full bg-white/15" />
			</div>
			<AnimatePresence initial={false} mode="wait">
				{!hasStarted ? (
					<motion.div
						key="empty"
						initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
						transition={{ type: "spring", duration: 0.28, bounce: 0 }}
						className="flex h-[calc(100%-0.5rem)] items-center justify-center px-3"
					>
						<button
							type="button"
							onClick={onGenerate}
							disabled={!canGenerate}
							aria-label="Tour"
							className="polished-button flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-neutral-200 hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-neutral-600"
						>
							<Map size={13} />
							Tour
						</button>
					</motion.div>
				) : (
					<motion.div
						key="body"
						initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
						transition={{ type: "spring", duration: 0.28, bounce: 0 }}
						className="h-[calc(100%-0.5rem)]"
					>
						<div className="flex h-10 items-center justify-between border-b border-white/8 px-3">
							{hasBody || generating || stale ? (
								<div className="flex items-center gap-2">
									<p className="text-sm font-medium text-neutral-300">Tour</p>
									{stale ? (
										<span className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-600">
											stale
										</span>
									) : null}
								</div>
							) : (
								<div />
							)}
							<div className="flex items-center gap-2">
								{generating ? (
									<div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
										<LoaderCircle className="size-3 animate-spin" />
										Generating
									</div>
								) : null}
								<button
									type="button"
									onClick={onGenerate}
									disabled={generating || !canGenerate}
									aria-label={generating ? "Generating tour" : hasTour ? "Refresh tour" : "Tour"}
									className="polished-button flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-neutral-200 hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-neutral-600"
								>
									{hasTour ? <RefreshCw size={13} /> : <Map size={13} />}
									{hasTour ? "Refresh" : "Tour"}
								</button>
							</div>
						</div>
						{error && hasBody ? (
							<div className="flex items-start gap-2 px-3 py-3 text-xs leading-5 text-red-300/85">
								<AlertCircle className="mt-0.5 size-3.5 shrink-0" />
								<p>{error}</p>
							</div>
						) : hasBody ? (
							<div className="h-[calc(100%-2.5rem)] overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-sm leading-6 text-neutral-300">
								{renderBoldSpans(tour)}
							</div>
						) : null}
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	)
}
