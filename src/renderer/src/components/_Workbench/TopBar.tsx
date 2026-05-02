import { Tally1 } from "lucide-react"

export default function TopBar() {
	return (
		<div className="w-full h-11 bg-neutral-900 border-b border-white/5 flex items-center justify-between shrink-0 px-5">
			<div className="flex items-center gap-2 text-sm font-medium">
				<span className="text-white tracking-wide">NULLOTH</span>
				<Tally1 size={14} className="text-neutral-600" />
				<span className="text-neutral-400">Workbench</span>
			</div>
			<span className="text-xs text-neutral-600 tabular-nums">v1.1.0</span>
		</div>
	)
}
