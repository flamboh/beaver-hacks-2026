import { useMemo } from "react"
import { Chat } from "@renderer/components/chat"
import { useAgentSnapshot } from "@renderer/agentStore"
import type { AgentRow } from "@renderer/types/models"
import type { AgentSnapshot } from "../../../../../main/agent/ipc"

type AgentThread = AgentSnapshot["threads"][number]
type PlanStatus = "pending" | "inProgress" | "completed"
type PlanStep = {
	step: string
	status: PlanStatus
}
type PlanActivityPayload = {
	plan?: Array<{
		step?: string
		status?: string
	}>
}

const PRIORITY_LEVELS = ["low", "medium", "high"] as const

const priorityStyles: Record<(typeof PRIORITY_LEVELS)[number], string> = {
	low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
	high: "bg-red-500/15 text-red-400 border-red-500/30"
}

interface AgentCardProps {
	agent: AgentRow
	thread: AgentThread | null
	workspacePath: string
}

export default function AgentCard({ agent, thread, workspacePath }: AgentCardProps) {
	const snapshot = useAgentSnapshot()
	const fallbackThread = useMemo(
		() =>
			snapshot.threads.find(
				(thread) => thread.id === snapshot.activeThreadId && thread.cwd === workspacePath
			) ??
			snapshot.threads.findLast((thread) => thread.cwd === workspacePath) ??
			null,
		[workspacePath, snapshot]
	)
	const activeThread = thread ?? fallbackThread
	const sessionStatus = activeThread?.session?.status ?? "idle"
	const isRunning = sessionStatus === "starting" || sessionStatus === "running"
	const planSteps = useMemo(() => derivePlanSteps(activeThread), [activeThread])
	const currentTask =
		planSteps.find((step) => step.status === "inProgress") ??
		planSteps.find((step) => step.status === "pending") ??
		planSteps[planSteps.length - 1] ??
		null
	const priority = agent.effort === "low" || agent.effort === "high" ? agent.effort : "medium"
	const modelName = activeThread?.model ?? agent.model

	return (
		<div
			className="flex flex-col overflow-hidden rounded-xl border border-white/8 bg-neutral-900 text-white shadow-2xl shadow-black/40"
			style={{ width: 1040, height: 680 }}
			onMouseDown={(event) => event.stopPropagation()}
			onMouseMove={(event) => event.stopPropagation()}
			onWheel={(event) => event.stopPropagation()}
		>
			<div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 bg-neutral-800/60 px-5">
				<span className="min-w-0 truncate text-sm font-semibold tracking-wide text-neutral-100">
					{activeThread?.title ?? agent.name}
				</span>
				<div className="flex items-center gap-2">
					<span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-500">
						{sessionStatus}
					</span>
					<button className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-400 transition-all duration-150 hover:border-red-500/60 hover:bg-red-500/10">
						Terminate
					</button>
				</div>
			</div>

			<div className="flex flex-1 overflow-hidden">
				<div className="flex w-72 shrink-0 flex-col gap-5 border-r border-white/5 px-4 py-4">
					<div className="flex min-w-0 flex-col gap-1.5">
						<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
							Current Task
						</span>
						<div className="break-words rounded-lg border border-white/5 bg-neutral-800/60 px-3 py-2.5 text-sm leading-relaxed text-neutral-300">
							{currentTask?.step ?? "No plan tasks yet."}
						</div>
					</div>

					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
							Tasks
						</span>
						<div className="nowheel min-h-0 flex-1 overflow-y-auto pr-1">
							{planSteps.length > 0 ? (
								<ol className="flex flex-col gap-1.5">
									{planSteps.map((task, i) => (
										<li
											key={`${task.status}:${task.step}`}
											className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-400"
										>
											<span className="mt-px shrink-0 tabular-nums text-neutral-700">{i + 1}.</span>
											<span
												className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
													task.status === "completed"
														? "bg-emerald-400/70"
														: task.status === "inProgress"
															? "bg-blue-300/80"
															: "bg-neutral-700"
												}`}
											/>
											<span
												className={`min-w-0 break-words leading-snug ${
													task.status === "completed"
														? "text-neutral-600 line-through decoration-neutral-700"
														: task.status === "inProgress"
															? "text-neutral-200"
															: ""
												}`}
											>
												{task.step}
											</span>
										</li>
									))}
								</ol>
							) : (
								<p className="rounded-lg border border-white/5 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-600">
									Waiting for plan tool updates.
								</p>
							)}
						</div>
					</div>

					<div className="flex flex-col gap-1">
						<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
							Model
						</span>
						<span className="break-words font-mono text-xs text-neutral-400">{modelName}</span>
					</div>
				</div>

				<div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-4">
					<div className="flex shrink-0 items-center gap-3">
						<div className="flex items-center gap-1">
							{PRIORITY_LEVELS.map((level) => (
								<span
									key={level}
									className={`rounded-md border px-2 py-0.5 text-[11px] capitalize transition-colors ${
										priority === level
											? priorityStyles[level]
											: "border-white/5 bg-transparent text-neutral-700"
									}`}
								>
									{level}
								</span>
							))}
						</div>
						<span className="min-w-0 break-words text-xs text-neutral-600">
							Scope: <span className="font-mono text-blue-400/80">{agent.scope_path}</span>
						</span>
					</div>

					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/5 bg-neutral-950">
						<div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-white/5 bg-neutral-900/60 px-3">
							<span className="size-2.5 rounded-full bg-red-500/50" />
							<span className="size-2.5 rounded-full bg-yellow-500/50" />
							<span className="size-2.5 rounded-full bg-emerald-500/50" />
							<span className="ml-2 font-mono text-[10px] text-neutral-700">chat</span>
						</div>
						<div className="min-h-0 flex-1">
							<Chat thread={activeThread} isRunning={isRunning} cwd={workspacePath} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function derivePlanSteps(thread: AgentThread | null): PlanStep[] {
	const latestPlan = thread?.activities
		.filter((activity) => activity.kind === "plan.updated")
		.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
		.at(-1)
	if (!latestPlan) return []

	const payload = latestPlan.payload as PlanActivityPayload
	const rawPlan = Array.isArray(payload.plan) ? payload.plan : []
	return rawPlan
		.map((entry) => ({
			step: entry.step ?? "",
			status: normalizePlanStatus(entry.status)
		}))
		.filter((entry) => entry.step.trim().length > 0)
}

function normalizePlanStatus(status: string | undefined): PlanStatus {
	if (status === "completed") return "completed"
	if (status === "inProgress" || status === "in_progress") return "inProgress"
	return "pending"
}
