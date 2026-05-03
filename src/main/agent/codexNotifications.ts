import type { CodexWireMessage } from "./codexJsonRpc"
import type { AgentPlan, AgentPlanItemStatus, ProviderRuntimeEvent } from "./contracts"

function readPath(payload: unknown, path: string[]): unknown {
	let cursor = payload as Record<string, unknown> | undefined | null
	for (const segment of path) {
		cursor = cursor?.[segment] as Record<string, unknown> | undefined | null
	}
	return cursor
}

function readText(value: unknown): string | undefined {
	return value === undefined || value === null ? undefined : String(value)
}

function readArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : []
}

function itemType(params: unknown): string {
	return readText(readPath(params, ["item", "type"])) ?? "item"
}

function itemCommand(params: unknown): string | undefined {
	return readText(readPath(params, ["item", "command"]))
}

function itemTitle(params: unknown): string | undefined {
	return readText(readPath(params, ["item", "title"]))
}

function itemSummary(params: unknown): { kind: string; summary: string } | null {
	const type = itemType(params)
	const command = itemCommand(params)
	if (type === "commandExecution") {
		return {
			kind: "command.execution",
			summary: command ? `Ran command: ${command}` : "Ran command"
		}
	}
	if (type === "fileChange") return { kind: "file.change", summary: "Changed files" }
	if (type === "plan") return { kind: "plan.updated", summary: "Updated plan" }
	if (type === "mcpToolCall" || type === "toolCall") {
		return { kind: "tool.call", summary: itemTitle(params) ?? "Called tool" }
	}
	return null
}

function planStatus(value: unknown): AgentPlanItemStatus {
	const status = readText(value)
	if (
		status === "pending" ||
		status === "in_progress" ||
		status === "completed" ||
		status === "cancelled"
	) {
		return status
	}
	if (status === "inProgress") return "in_progress"
	if (status === "in-progress") return "in_progress"
	if (status === "done") return "completed"
	return "pending"
}

function planFromParams(params: unknown, createdAt: string): AgentPlan | null {
	const plan = readPath(params, ["plan"])
	const rawItems =
		readArray(plan).length > 0 ? readArray(plan) : readArray(readPath(plan, ["items"]))
	if (rawItems.length === 0) return null

	const items = rawItems.map((item, index) => {
		const title =
			readText(
				readPath(item, ["step"]) ??
					readPath(item, ["title"]) ??
					readPath(item, ["description"]) ??
					readPath(item, ["text"]) ??
					readPath(item, ["task"])
			)?.trim() || `Plan item ${index + 1}`
		return {
			id: readText(readPath(item, ["id"])) ?? `plan-item:${index}`,
			title,
			status: planStatus(readPath(item, ["status"])),
			detail: readText(readPath(item, ["detail"]) ?? readPath(item, ["notes"])) ?? null,
			updatedAt: readText(readPath(item, ["updatedAt"])) ?? createdAt
		}
	})

	return {
		items,
		source: "codex",
		updatedAt: createdAt
	}
}

export function providerThreadIdForNotification(message: CodexWireMessage): string | undefined {
	const params = message.params
	return readText(
		readPath(params, ["thread", "id"]) ??
			readPath(params, ["threadId"]) ??
			readPath(params, ["turn", "threadId"])
	)
}

export function codexNotificationEvents(input: {
	message: CodexWireMessage
	appThreadId: string
	createdAt: string
}): ProviderRuntimeEvent[] {
	const method = input.message.method
	const params = input.message.params
	if (!method) return []

	const turnId = readText(readPath(params, ["turn", "id"]) ?? readPath(params, ["turnId"])) ?? null
	const itemId = readText(readPath(params, ["item", "id"]) ?? readPath(params, ["itemId"])) ?? null

	if (method === "turn/started" && turnId) {
		return [
			{
				type: "turn.started",
				threadId: input.appThreadId,
				turnId,
				createdAt: input.createdAt,
				payload: {}
			}
		]
	}

	if (method === "turn/completed") {
		const status = readText(readPath(params, ["turn", "status"])) ?? "completed"
		const error = readText(readPath(params, ["turn", "error", "message"]))
		return [
			{
				type: "turn.completed",
				threadId: input.appThreadId,
				turnId,
				createdAt: input.createdAt,
				payload: {
					status:
						status === "failed" ||
						status === "cancelled" ||
						status === "interrupted" ||
						status === "completed"
							? status
							: "completed",
					...(error ? { error } : {})
				}
			}
		]
	}

	if (method === "item/agentMessage/delta") {
		const delta = readText(readPath(params, ["delta"]) ?? readPath(params, ["textDelta"]))
		if (!delta) return []
		return [
			{
				type: "assistant.delta",
				threadId: input.appThreadId,
				turnId,
				itemId,
				createdAt: input.createdAt,
				payload: { delta }
			}
		]
	}

	if (method === "turn/plan/updated") {
		const plan = planFromParams(params, input.createdAt)
		if (!plan) return [activity(input, turnId, "plan.updated", "Updated plan", params)]
		return [
			{
				type: "plan.updated",
				threadId: input.appThreadId,
				turnId,
				createdAt: input.createdAt,
				payload: { plan }
			}
		]
	}

	if (method === "item/plan/delta") {
		const delta = readText(readPath(params, ["delta"]))
		return [
			activity(
				input,
				turnId,
				"plan.delta",
				delta ? `Updated plan: ${delta}` : "Updated plan",
				params
			)
		]
	}

	if (method === "item/commandExecution/outputDelta") {
		const delta = readText(readPath(params, ["delta"]))
		return delta ? [activity(input, turnId, "command.output", delta, params)] : []
	}

	if (method !== "item/started" && method !== "item/completed") return []

	const summary = itemSummary(params)
	if (!summary) return []
	if (summary.kind === "command.execution" && method === "item/completed") return []
	if (summary.kind === "file.change" && method === "item/started") return []
	return [activity(input, turnId, summary.kind, summary.summary, params)]
}

function activity(
	input: {
		appThreadId: string
		createdAt: string
	},
	turnId: string | null,
	kind: string,
	summary: string,
	detail: unknown
): Extract<ProviderRuntimeEvent, { type: "activity" }> {
	return {
		type: "activity",
		threadId: input.appThreadId,
		turnId,
		createdAt: input.createdAt,
		payload: {
			kind,
			summary,
			detail
		}
	}
}
