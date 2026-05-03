import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

type PromptQueueItem = SDKUserMessage | null

export class ClaudePromptQueue implements AsyncIterable<SDKUserMessage> {
	private readonly items: PromptQueueItem[] = []
	private readonly waiters: Array<(item: PromptQueueItem) => void> = []

	push(item: PromptQueueItem): void {
		const waiter = this.waiters.shift()
		if (waiter) {
			waiter(item)
			return
		}
		this.items.push(item)
	}

	async *[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
		while (true) {
			const item = await this.next()
			if (item === null) return
			yield item
		}
	}

	private next(): Promise<PromptQueueItem> {
		const item = this.items.shift()
		if (item !== undefined) return Promise.resolve(item)
		return new Promise((resolve) => this.waiters.push(resolve))
	}
}
