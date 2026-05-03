import type { JSX } from "react"
import {
	normalizeTaskStatus,
	TASK_STATUS_ORDER,
	type AgentTaskSummary,
	type TaskStatus
} from "./agentTaskSummary"

interface AgentTaskTooltipProps {
	summary: AgentTaskSummary
}

export default function AgentTaskTooltip({ summary }: AgentTaskTooltipProps): JSX.Element {
	const groupedTasks = TASK_STATUS_ORDER.map((status) => ({
		status,
		tasks: summary.tasks.filter((task) => normalizeTaskStatus(task.status) === status)
	})).filter((group) => group.tasks.length > 0)

	const statusDotClass: Record<TaskStatus, string> = {
		failed: "bg-red-600",
		current: "bg-blue-400",
		complete: "bg-emerald-400",
		pending: "bg-orange-400"
	}

	return (
		<div className="pointer-events-none absolute left-1/2 top-4 z-30 w-[21rem] -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900/95 p-3 opacity-0 shadow-2xl shadow-black/40 backdrop-blur transition duration-150 group-hover:opacity-100">
			{summary.tasks.length === 0 ? (
				<p className="text-xs text-neutral-300">
					This agent is idle because it does not have any tasks yet.
				</p>
			) : (
				<div className="flex flex-col gap-2.5">
					<div className="flex items-center justify-between">
						<p className="text-[11px] uppercase tracking-widest text-neutral-500">Task Status</p>
						<p className="text-xs text-neutral-400">{summary.tasks.length} total</p>
					</div>

					<div className="overflow-y-auto rounded-md border border-white/8 bg-black/20 p-2">
						<div className="flex flex-col gap-2 text-xs text-neutral-300">
							{groupedTasks.map((group) => (
								<ul key={group.status} className="flex flex-col gap-1">
									{group.tasks.map((task) => (
										<li key={task.id} className="flex items-center gap-2">
											<span
												className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass[group.status]}`}
											/>
											<span className="truncate">{task.description || "(No description)"}</span>
										</li>
									))}
								</ul>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<p className="text-[11px] uppercase tracking-widest text-neutral-500">Batches</p>
						<div className="flex justify-center gap-1.5">
							{summary.batches.map((batch) => (
								<div key={batch.batchId} className="relative h-[5rem] w-[5rem] shrink-0">
									<div
										className="absolute inset-0 rounded-full border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
										style={{ background: batch.pieGradient }}
									/>
									<div className="absolute inset-2 rounded-full border border-white/10 bg-neutral-950/90" />
									<div className="absolute inset-0 rounded-full bg-[repeating-conic-gradient(from_-90deg,rgba(255,255,255,0.16)_0deg_1deg,transparent_1deg_18deg)] opacity-30" />
									<div className="absolute inset-0 flex items-center justify-center">
										<span className="rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] text-neutral-200">
											{batch.total}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
