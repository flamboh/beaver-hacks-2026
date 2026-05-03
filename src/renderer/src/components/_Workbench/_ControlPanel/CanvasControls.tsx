import { Maximize2, ScanSearch } from "lucide-react"

interface CanvasControlsProps {
	onToggleFit: () => void
	showFitAll: boolean
}

export function CanvasControls({ onToggleFit, showFitAll }: CanvasControlsProps) {
	const ToggleIcon = showFitAll ? Maximize2 : ScanSearch
	const toggleLabel = showFitAll ? "Fit all agents" : "Actual size"
	return (
		<div className="nodrag absolute right-3 bottom-3 flex items-center rounded-md border border-white/8 bg-neutral-900/85 p-1 shadow-xl shadow-black/30 backdrop-blur-sm">
			<button
				type="button"
				onClick={onToggleFit}
				className="flex size-7 items-center justify-center rounded text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-100"
				aria-label={toggleLabel}
				title={showFitAll ? "Fit all" : "Actual size"}
			>
				<ToggleIcon size={14} />
			</button>
		</div>
	)
}
