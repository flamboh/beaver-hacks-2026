import { Circle, CircleCheckBig, CircleSlash, LoaderCircle } from "lucide-react"
import type { AgentSnapshot } from "../../../../../main/agent/ipc"

type AgentPlan = AgentSnapshot["threads"][number]["plan"]
type PlanItem = AgentPlan["items"][number]

function TaskMarker({ status }: { status: PlanItem["status"] }) {
	if (status === "completed") {
		return <CircleCheckBig className="mt-0.5 shrink-0 text-emerald-400" size={16} />
	}

	if (status === "in_progress") {
		return <LoaderCircle className="mt-0.5 shrink-0 animate-spin text-yellow-300" size={16} />
	}

	if (status === "cancelled") {
		return <CircleSlash className="mt-0.5 shrink-0 text-neutral-600" size={16} />
	}

	return <Circle className="mt-0.5 shrink-0 text-neutral-700" size={16} />
}

function taskTextClass(status: PlanItem["status"]): string {
	if (status === "completed") return "text-neutral-600 line-through"
	if (status === "in_progress") return "text-neutral-200"
	if (status === "cancelled") return "text-neutral-700 line-through"
	return "text-neutral-400"
}

export default function TaskList({ plan }: { plan: AgentPlan | null }) {
	const tasks = plan?.items ?? []

	return (
		<div className="flex min-h-0 flex-1 select-none flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
					Task List
				</span>
				{plan?.updatedAt ? (
					<span className="text-[10px] uppercase tracking-widest text-neutral-700">
						{plan.source ?? "agent"}
					</span>
				) : null}
			</div>
			{tasks.length === 0 ? (
				<p className="text-xs leading-5 text-neutral-700">Plan appears once the agent starts.</p>
			) : (
				<ol className="min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5">
					{tasks.map((task, index) => (
						<li key={task.id} className="flex items-start gap-2 text-sm">
							<TaskMarker status={task.status} />
							<div className="flex min-w-0 items-start gap-1.5">
								<span
									className={`shrink-0 tabular-nums ${
										task.status === "completed" ? "text-neutral-700" : "text-neutral-500"
									}`}
								>
									{index + 1})
								</span>
								<span className={`leading-snug ${taskTextClass(task.status)}`}>{task.title}</span>
							</div>
						</li>
					))}
				</ol>
			)}
		</div>
	)
}
