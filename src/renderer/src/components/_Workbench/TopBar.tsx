import { Tally1, PanelLeft } from "lucide-react"

interface Props {
	onToggleSidebar: () => void
}

export default function TopBar({ onToggleSidebar }: Props) {
	return (
		<div className="w-full h-11 bg-neutral-900 border-b border-white/5 flex items-center justify-between shrink-0 px-3">
			<div className="flex items-center gap-2">
				<button
					onClick={onToggleSidebar}
					className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors duration-150"
					title="Toggle sidebar"
				>
					<PanelLeft size={15} />
				</button>
				<div className="flex items-center gap-2 text-sm font-medium ml-1">
					<span className="text-white tracking-wide">NULLOTH</span>
					<Tally1 size={14} className="text-neutral-600" />
					<span className="text-neutral-400">Workbench</span>
				</div>
			</div>
			<span className="text-xs text-neutral-600 tabular-nums">v1.1.0</span>
		</div>
	)
}
