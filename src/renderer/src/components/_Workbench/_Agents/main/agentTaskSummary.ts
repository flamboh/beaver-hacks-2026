import type { TaskRow } from "@renderer/types/models"
import type { AgentStatus } from "../AgentsSidebar"

export type TaskStatus = "pending" | "current" | "complete" | "failed"

export type TaskStatusCounts = Record<TaskStatus, number>

export type BatchSummary = {
	batchId: string
	total: number
	counts: TaskStatusCounts
	pieGradient: string
	tasks: TaskRow[]
}

export type AgentTaskSummary = {
	status: AgentStatus
	current_task: string
	counts: TaskStatusCounts
	batches: BatchSummary[]
	tasks: TaskRow[]
}

const TASK_PIE_COLORS: Record<TaskStatus, string> = {
	pending: "#fb923c",
	current: "#60a5fa",
	complete: "#34d399",
	failed: "#ef4444"
}

export const TASK_STATUS_ORDER: TaskStatus[] = ["failed", "current", "pending", "complete"]

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
	pending: "bg-orange-500/15 text-orange-300 border-orange-500/25",
	current: "bg-blue-500/15 text-blue-300 border-blue-500/25",
	complete: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
	failed: "bg-red-500/15 text-red-300 border-red-500/25"
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
	pending: "Pending",
	current: "Current",
	complete: "Complete",
	failed: "Failed"
}

function emptyTaskCounts(): TaskStatusCounts {
	return { pending: 0, current: 0, complete: 0, failed: 0 }
}

export function normalizeTaskStatus(status: string): TaskStatus {
	if (status === "current" || status === "complete" || status === "failed") return status
	return "pending"
}

function buildPieGradient(counts: TaskStatusCounts, total: number): string {
	if (total === 0) return "conic-gradient(#3f3f46 0deg 360deg)"
	let offset = 0
	const slices: string[] = []
	for (const status of TASK_STATUS_ORDER) {
		const value = counts[status]
		if (value === 0) continue
		const start = (offset / total) * 360
		offset += value
		const end = (offset / total) * 360
		slices.push(`${TASK_PIE_COLORS[status]} ${start}deg ${end}deg`)
	}
	return `conic-gradient(${slices.join(", ")})`
}

export function summarizeTasks(tasks: TaskRow[]): AgentTaskSummary {
	if (tasks.length === 0) {
		return {
			status: "idle",
			current_task: "",
			counts: emptyTaskCounts(),
			batches: [],
			tasks: []
		}
	}

	const counts = emptyTaskCounts()
	const byBatch = new Map<string, TaskRow[]>()

	for (const task of tasks) {
		const status = normalizeTaskStatus(task.status)
		counts[status] += 1
		const batchTasks = byBatch.get(task.batch_id)
		if (batchTasks) {
			batchTasks.push(task)
		} else {
			byBatch.set(task.batch_id, [task])
		}
	}

	const status: AgentStatus =
		counts.failed > 0
			? "failure"
			: counts.current > 0
				? "working"
				: counts.pending > 0
					? "pending"
					: "idle"

	const current =
		tasks.find((task) => normalizeTaskStatus(task.status) === "current") ??
		tasks.find((task) => normalizeTaskStatus(task.status) === "pending") ??
		null

	const batches = [...byBatch.entries()].map(([batchId, batchTasks]) => {
		const batchCounts = emptyTaskCounts()
		for (const task of batchTasks) {
			batchCounts[normalizeTaskStatus(task.status)] += 1
		}
		return {
			batchId,
			total: batchTasks.length,
			counts: batchCounts,
			pieGradient: buildPieGradient(batchCounts, batchTasks.length),
			tasks: batchTasks
		}
	})

	return {
		status,
		current_task: current?.description.trim() ?? "",
		counts,
		batches,
		tasks
	}
}
