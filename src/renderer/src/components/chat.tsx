import type { FormEvent, JSX } from "react"
import { useState } from "react"
import { AlertTriangle, ChevronDown, FileText, ListChecks, Terminal, Wrench } from "lucide-react"
import { sendAgentMessage } from "../agentStore"
import type { AgentSnapshot } from "../../../main/agent/ipc"
import { GitBranchControls } from "./GitBranchControls"

type AgentThread = AgentSnapshot["threads"][number]
type AgentMessage = AgentThread["messages"][number]
type AgentActivity = AgentThread["activities"][number]

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
			activity: AgentActivity
	  }

type TranscriptBlock =
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

interface ChatProps {
	thread: AgentThread | null
	threadId: string
	isRunning: boolean
	cwd: string
	model?: string
	onFirstMessage?: (prompt: string) => Promise<void>
	provider?: AgentThread["provider"]
	workspaceId: string
}

export function Chat({
	thread,
	threadId,
	isRunning,
	cwd,
	model,
	onFirstMessage,
	provider,
	workspaceId
}: ChatProps): JSX.Element {
	const [draft, setDraft] = useState("")
	const [isSending, setIsSending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [branchOpen, setBranchOpen] = useState(false)
	const canSend = draft.trim().length > 0 && !isSending && !isRunning
	const transcript = thread ? buildTranscript(thread) : []

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const prompt = draft.trim()
		if (!prompt || isSending || isRunning) return

		setDraft("")
		setError(null)
		setIsSending(true)
		void Promise.resolve()
			.then(() => (thread ? undefined : onFirstMessage?.(prompt)))
			.then(() =>
				sendAgentMessage({
					prompt,
					cwd,
					threadId: thread?.id ?? threadId,
					...(thread || !provider ? {} : { provider }),
					...(thread || !model ? {} : { model })
				})
			)
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : String(cause))
				setDraft(prompt)
			})
			.finally(() => setIsSending(false))
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<section className="nowheel nodrag min-h-0 flex-1 overflow-y-auto px-4 py-5">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
					{thread ? (
						transcript.map((block) => <TranscriptBlockView key={block.id} block={block} />)
					) : (
						<div className="mt-24 text-center">
							<h2 className="text-lg font-medium text-zinc-100">Ask Codex</h2>
							<p className="mt-2 text-sm text-zinc-500">Send a message to start the loop.</p>
						</div>
					)}
				</div>
			</section>

			<footer className="shrink-0 border-t border-white/10 bg-[#0c0c0f] p-4">
				<form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
					<textarea
						value={draft}
						onChange={(event) => setDraft(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.currentTarget.form?.requestSubmit()
								event.preventDefault()
							}
						}}
						rows={2}
						placeholder="Message Codex..."
						className="min-h-12 flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/20"
					/>
					<button
						type="submit"
						disabled={!canSend}
						className="h-12 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						Send
					</button>
				</form>
				<div className="mx-auto mt-3 max-w-3xl">
					<button
						type="button"
						onClick={() => setBranchOpen((v) => !v)}
						className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors duration-150"
					>
						<ChevronDown
							size={12}
							className={`transition-transform duration-200 ${branchOpen ? "rotate-180" : ""}`}
						/>
						Branch
					</button>
					<div
						className="overflow-hidden transition-[max-height] duration-200"
						style={{ maxHeight: branchOpen ? 200 : 0 }}
					>
						<div className="pt-2">
							<GitBranchControls workspaceId={workspaceId} />
						</div>
					</div>
				</div>
				{error ? <p className="mx-auto mt-2 max-w-3xl text-xs text-red-400">{error}</p> : null}
			</footer>
		</div>
	)
}

function buildTranscript(thread: AgentThread): TranscriptBlock[] {
	const events = [
		...thread.messages.map((message, index) => ({
			type: "message" as const,
			message,
			createdAt: message.createdAt,
			index
		})),
		...thread.activities
			.filter((activity) => activity.turnId)
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
	const lastItem = block.items.at(-1)
	if (lastItem?.kind === "text") {
		lastItem.text += message.text
		lastItem.streaming ||= message.streaming
		block.streaming ||= message.streaming
		return
	}

	block.items.push({
		kind: "text",
		id: message.id,
		text: message.text,
		streaming: message.streaming,
		createdAt: message.createdAt
	})
	block.streaming ||= message.streaming
}

function appendActivityBlock(blocks: TranscriptBlock[], activity: AgentActivity): void {
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

function shouldMergeActivities(current: AgentActivity, next: AgentActivity): boolean {
	return current.kind === "command.output" && next.kind === "command.output"
}

function TranscriptBlockView({ block }: { block: TranscriptBlock }): JSX.Element {
	if (block.kind === "user") {
		return (
			<article className="ml-auto max-w-[78%] rounded-lg bg-white px-3 py-2 text-sm text-zinc-950">
				<p className="whitespace-pre-wrap">{block.message.text}</p>
			</article>
		)
	}

	return (
		<article className="mr-auto flex max-w-[86%] flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-zinc-100">
			{block.items.map((item) => {
				if (item.kind === "text") {
					return (
						<p key={item.id} className="whitespace-pre-wrap">
							{item.text}
						</p>
					)
				}
				return <ActivityInline key={item.activity.id} activity={item.activity} />
			})}
			{block.streaming ? <StreamingDots /> : null}
		</article>
	)
}

function ActivityInline({ activity }: { activity: AgentActivity }): JSX.Element {
	const meta = activityMeta(activity.kind)
	const Icon = meta.icon
	const isOutput = activity.kind === "command.output"

	return (
		<div
			className={`inline-flex max-w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-5 ${meta.className}`}
		>
			<Icon size={13} className="mt-1 shrink-0" />
			<div className="min-w-0">
				<span className="font-medium">{meta.label}</span>
				<span className="text-neutral-500"> · </span>
				{isOutput ? (
					<code className="block max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-neutral-300">
						{activity.summary}
					</code>
				) : (
					<span className="break-words text-neutral-300">{activity.summary}</span>
				)}
			</div>
		</div>
	)
}

function activityMeta(kind: string): {
	label: string
	icon: typeof Wrench
	className: string
} {
	if (kind === "command.execution" || kind === "command.output") {
		return {
			label: kind === "command.output" ? "Output" : "Command",
			icon: Terminal,
			className: "border-blue-500/20 bg-blue-500/8 text-blue-300"
		}
	}
	if (kind === "file.change") {
		return {
			label: "Files",
			icon: FileText,
			className: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300"
		}
	}
	if (kind.startsWith("plan.")) {
		return {
			label: "Plan",
			icon: ListChecks,
			className: "border-amber-500/20 bg-amber-500/8 text-amber-300"
		}
	}
	if (kind === "runtime.error") {
		return {
			label: "Error",
			icon: AlertTriangle,
			className: "border-red-500/25 bg-red-500/10 text-red-300"
		}
	}
	return {
		label: kind.includes("tool") ? "Tool" : "Event",
		icon: Wrench,
		className: "border-white/10 bg-white/[0.03] text-neutral-300"
	}
}

function StreamingDots(): JSX.Element {
	return (
		<span className="mt-1 flex items-center gap-1">
			<span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
			<span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
			<span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
		</span>
	)
}
