export type AgentStatus = "failure" | "pending" | "working" | "idle"

type AgentsSidebarProps = {
	total: number
	counts: Record<AgentStatus, number>
	onStatusHover: (status: AgentStatus | null) => void
}

const STATUS_ROWS: { label: string; status: AgentStatus; dot: string }[] = [
	{ label: "Working", status: "working", dot: "bg-blue-400" },
	{ label: "Pending", status: "pending", dot: "bg-orange-400" },
	{ label: "Idle", status: "idle", dot: "bg-neutral-500" },
	{ label: "Failed", status: "failure", dot: "bg-red-500" }
]

export default function AgentsSidebar({ total, counts, onStatusHover }: AgentsSidebarProps) {
	return (
		<aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-white/5 bg-neutral-950">
			<div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
				<div>
					<p className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
						Agents
					</p>
					<p className="mt-0.5 text-sm font-medium text-neutral-200">{total} Agents</p>
				</div>
			</div>

			<div className="flex flex-col gap-1 px-2 py-3">
				{STATUS_ROWS.map((row) => (
					<div
						key={row.label}
						onMouseEnter={() => onStatusHover(row.status)}
						onMouseLeave={() => onStatusHover(null)}
						className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm transition-colors duration-300 hover:bg-white/5"
					>
						<div className="flex items-center gap-2">
							<span className={`h-2 w-2 rounded-full ${row.dot}`} />
							<span className="text-neutral-400">{row.label}</span>
						</div>
						<span className="font-mono text-xs text-neutral-500">{counts[row.status]}</span>
					</div>
				))}
			</div>
		</aside>
	)
}
