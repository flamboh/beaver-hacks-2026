import { Check, CircleDot } from "lucide-react"

type TaskStatus = "done" | "active" | "pending"

type PlaceholderTask = {
	description: string
	status: TaskStatus
}

const PLACEHOLDER_TASKS: PlaceholderTask[] = [
	{ description: "Audit existing portfolio layout and routes", status: "done" },
	{ description: "Identify reusable components for the homepage refresh", status: "done" },
	{ description: "Implement responsive hero section polish", status: "active" },
	{ description: "Refine project card spacing and hover states", status: "pending" },
	{ description: "Verify mobile navigation and page transitions", status: "pending" },
	{ description: "Run final lint, typecheck, and visual review", status: "pending" }
]

function TaskMarker({ status }: { status: TaskStatus }) {
	if (status === "done") {
		return (
			<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
				<Check size={11} strokeWidth={2.5} />
			</span>
		)
	}

	if (status === "active") {
		return (
			<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-yellow-400">
				<CircleDot size={14} strokeWidth={2.3} />
			</span>
		)
	}

	return <span className="mt-0.5 size-4 shrink-0" />
}

export default function TaskList() {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<span className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
				Task List
			</span>
			<ol className="flex flex-col gap-2.5">
				{PLACEHOLDER_TASKS.map((task, index) => (
					<li key={task.description} className="flex items-start gap-2 text-sm">
						<TaskMarker status={task.status} />
						<div className="flex min-w-0 items-start gap-1.5">
							<span
								className={`shrink-0 tabular-nums ${
									task.status === "done" ? "text-neutral-700" : "text-neutral-500"
								}`}
							>
								{index + 1})
							</span>
							<span
								className={`leading-snug ${
									task.status === "done"
										? "text-neutral-600 line-through"
										: task.status === "active"
											? "text-neutral-200"
											: "text-neutral-400"
								}`}
							>
								{task.description}
							</span>
						</div>
					</li>
				))}
			</ol>
		</div>
	)
}
