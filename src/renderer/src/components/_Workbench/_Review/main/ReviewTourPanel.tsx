import { AlertCircle, LoaderCircle, Map as MapIcon, RefreshCw } from "lucide-react"
import { motion } from "motion/react"
import type { PointerEvent, ReactNode, RefObject } from "react"
import { useCallback, useRef, useState, useSyncExternalStore } from "react"

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
const STREAM_WORDS_PER_TICK = 8
const STREAM_TICK_MS = 45
const streamStarts = new Map<string, number>()

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

function visibleStreamLength(text: string): number {
	if (!text) return 0
	const startedAt = streamStarts.get(text)
	if (!startedAt) return 0
	const visibleWords =
		Math.floor((performance.now() - startedAt) / STREAM_TICK_MS) * STREAM_WORDS_PER_TICK
	if (visibleWords <= 0) return 0

	let words = 0
	for (let index = 0; index < text.length; index += 1) {
		const current = text[index]
		const previous = text[index - 1]
		if (current && /\S/.test(current) && (!previous || /\s/.test(previous))) {
			words += 1
			if (words > visibleWords) return index
		}
	}

	return text.length
}

function scrollToBottom(ref: RefObject<HTMLDivElement | null>): void {
	const element = ref.current
	if (element) element.scrollTop = element.scrollHeight
}

function useStreamingText(
	text: string,
	scrollRef: RefObject<HTMLDivElement | null>
): { streaming: boolean; text: string } {
	const subscribe = useCallback(
		(listener: () => void) => {
			if (!text) return () => undefined

			streamStarts.set(text, performance.now())
			let frame = 0
			const tick = () => {
				listener()
				requestAnimationFrame(() => scrollToBottom(scrollRef))
				if (visibleStreamLength(text) < text.length) {
					frame = requestAnimationFrame(tick)
				}
			}
			frame = requestAnimationFrame(tick)
			return () => {
				cancelAnimationFrame(frame)
				streamStarts.delete(text)
			}
		},
		[scrollRef, text]
	)
	const getSnapshot = useCallback(() => visibleStreamLength(text), [text])
	const visibleLength = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	return {
		streaming: visibleLength < text.length,
		text: text.slice(0, visibleLength)
	}
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
	const tourBodyRef = useRef<HTMLDivElement>(null)
	const [resizing, setResizing] = useState(false)
	const hasBody = Boolean(tour || error)
	const hasStarted = hasBody || generating
	const streamedTour = useStreamingText(tour, tourBodyRef)

	const startResize = (event: PointerEvent<HTMLDivElement>) => {
		resizeStart.current = { height, y: event.clientY }
		setResizing(true)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const resize = (event: PointerEvent<HTMLDivElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
		const delta = resizeStart.current.y - event.clientY
		onHeightChange(clampHeight(resizeStart.current.height + delta))
	}

	const stopResize = () => {
		setResizing(false)
	}

	return (
		<motion.section
			animate={{ height: clampHeight(height) }}
			className="mt-4 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-neutral-950"
			initial={false}
			transition={resizing ? { duration: 0 } : { duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
		>
			<div
				role="separator"
				aria-orientation="horizontal"
				onPointerDown={startResize}
				onPointerMove={resize}
				onPointerUp={stopResize}
				onPointerCancel={stopResize}
				onLostPointerCapture={stopResize}
				className="flex h-2 cursor-ns-resize items-center justify-center border-b border-white/5 bg-white/[0.02]"
			>
				<div className="h-px w-10 rounded-full bg-white/15" />
			</div>
			{!hasStarted ? (
				<div className="flex h-[calc(100%-0.5rem)] items-center justify-center p-3">
					<button
						type="button"
						onClick={onGenerate}
						disabled={!canGenerate}
						aria-label="Tour"
						className="cursor-pointer flex h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-neutral-200 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-neutral-600"
					>
						<MapIcon size={13} />
						Tour
					</button>
				</div>
			) : (
				<>
					<div className="relative flex h-10 items-center justify-end border-b border-white/8 px-3">
						{generating ? (
							<div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-[11px] text-neutral-500">
								<LoaderCircle className="size-3 animate-spin" />
								Generating
							</div>
						) : null}
						<div className="flex items-center gap-2">
							{stale ? (
								<span className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 uppercase">
									stale
								</span>
							) : null}
							<button
								type="button"
								onClick={onGenerate}
								disabled={generating || !canGenerate}
								aria-label={generating ? "Generating tour" : "Refresh tour"}
								className="cursor-pointer flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-neutral-200 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-neutral-600"
							>
								<RefreshCw size={13} />
								Refresh
							</button>
						</div>
					</div>
					{error && hasBody ? (
						<div className="flex items-start gap-2 px-3 py-3 text-xs leading-5 text-red-300/85">
							<AlertCircle className="mt-0.5 size-3.5 shrink-0" />
							<p>{error}</p>
						</div>
					) : hasBody ? (
						<div
							ref={tourBodyRef}
							className="h-[calc(100%-3rem)] overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-sm leading-6 text-neutral-300"
						>
							{renderBoldSpans(streamedTour.text)}
							{streamedTour.streaming ? (
								<span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse bg-neutral-400" />
							) : null}
						</div>
					) : null}
				</>
			)}
		</motion.section>
	)
}
