import type { AgentSnapshot } from "../../../main/agent/ipc"

type AgentThread = AgentSnapshot["threads"][number]
type AgentMessage = AgentThread["messages"][number]
export type TranscriptActivity = AgentThread["activities"][number]

type AssistantTranscriptItem =
	| {
			kind: "text"
			id: string
			text: string
			streaming: boolean
			createdAt: string
	  }
	| {
			kind: "activity"
			activity: TranscriptActivity
	  }

export type TranscriptBlock =
	| {
			kind: "user"
			id: string
			message: AgentMessage
			createdAt: string
	  }
	| {
			kind: "assistant"
			id: string
			turnId: string | null
			items: AssistantTranscriptItem[]
			streaming: boolean
			createdAt: string
	  }

export function buildTranscript(thread: AgentThread): TranscriptBlock[] {
	const events = [
		...thread.messages.map((message, index) => ({
			type: "message" as const,
			message,
			createdAt: message.createdAt,
			index
		})),
		...thread.activities
			.filter((activity) => activity.turnId || activity.kind.startsWith("security.scan."))
			.map((activity, index) => ({
				type: "activity" as const,
				activity,
				createdAt: activity.createdAt,
				index: thread.messages.length + index
			}))
	].sort((a, b) => {
		const time = a.createdAt.localeCompare(b.createdAt)
		return time === 0 ? a.index - b.index : time
	})

	const blocks: TranscriptBlock[] = []
	for (const event of events) {
		if (event.type === "message") {
			appendMessageBlock(blocks, event.message)
		} else {
			appendActivityBlock(blocks, event.activity)
		}
	}
	return blocks
}

function appendMessageBlock(blocks: TranscriptBlock[], message: AgentMessage): void {
	if (message.role === "user") {
		blocks.push({
			kind: "user",
			id: message.id,
			message,
			createdAt: message.createdAt
		})
		return
	}

	const block = assistantBlockFor(blocks, message.turnId, message.id, message.createdAt)
	block.items.push({
		kind: "text",
		id: message.id,
		text: message.text,
		streaming: message.streaming,
		createdAt: message.createdAt
	})
	block.streaming ||= message.streaming
}

function appendActivityBlock(blocks: TranscriptBlock[], activity: TranscriptActivity): void {
	const block = assistantBlockFor(blocks, activity.turnId, activity.id, activity.createdAt)
	const lastItem = block.items.at(-1)
	if (lastItem?.kind === "activity" && shouldMergeActivities(lastItem.activity, activity)) {
		lastItem.activity = {
			...activity,
			summary: `${lastItem.activity.summary}${activity.summary}`
		}
		return
	}
	block.items.push({ kind: "activity", activity })
}

function assistantBlockFor(
	blocks: TranscriptBlock[],
	turnId: string | null,
	fallbackId: string,
	createdAt: string
): Extract<TranscriptBlock, { kind: "assistant" }> {
	const last = blocks.at(-1)
	if (last?.kind === "assistant" && last.turnId === turnId) return last

	const block: Extract<TranscriptBlock, { kind: "assistant" }> = {
		kind: "assistant",
		id: `assistant-block:${turnId ?? fallbackId}`,
		turnId,
		items: [],
		streaming: false,
		createdAt
	}
	blocks.push(block)
	return block
}

function shouldMergeActivities(current: TranscriptActivity, next: TranscriptActivity): boolean {
	return current.kind === "command.output" && next.kind === "command.output"
}
