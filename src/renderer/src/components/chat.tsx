import type { FormEvent, JSX } from "react"
import { useState } from "react"
import { sendAgentMessage } from "../agentStore"
import type { AgentSnapshot } from "../../../main/agent/ipc"

type AgentThread = AgentSnapshot["threads"][number]
type TimelineItem =
	| { id: string; createdAt: string; kind: "message"; message: AgentThread["messages"][number] }
	| { id: string; createdAt: string; kind: "activity"; activity: AgentThread["activities"][number] }

interface ChatProps {
	thread: AgentThread | null
	isRunning: boolean
	cwd: string
}

export function Chat({ thread, isRunning, cwd }: ChatProps): JSX.Element {
	const [draft, setDraft] = useState("")
	const [isSending, setIsSending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const canSend = draft.trim().length > 0 && !isSending && !isRunning
	const timeline = thread ? buildTimeline(thread) : []

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const prompt = draft.trim()
		if (!prompt || isSending || isRunning) return

		setDraft("")
		setError(null)
		setIsSending(true)
		void sendAgentMessage({
			prompt,
			cwd,
			...(thread ? { threadId: thread.id } : {})
		})
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
						timeline.map((item) =>
							item.kind === "message" ? (
								<MessageBubble key={item.id} message={item.message} />
							) : (
								<ActivityBubble key={item.id} activity={item.activity} />
							)
						)
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
				{error ? <p className="mx-auto mt-2 max-w-3xl text-xs text-red-400">{error}</p> : null}
			</footer>
		</div>
	)
}

function buildTimeline(thread: AgentThread): TimelineItem[] {
	return [
		...thread.messages.map((message) => ({
			id: message.id,
			createdAt: message.createdAt,
			kind: "message" as const,
			message
		})),
		...thread.activities.filter(shouldShowActivity).map((activity) => ({
			id: activity.id,
			createdAt: activity.createdAt,
			kind: "activity" as const,
			activity
		}))
	].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function shouldShowActivity(activity: AgentThread["activities"][number]): boolean {
	return (
		activity.kind === "command.execution" ||
		activity.kind === "file.change" ||
		activity.kind === "tool.call"
	)
}

function MessageBubble({ message }: { message: AgentThread["messages"][number] }): JSX.Element {
	return (
		<article
			className={
				message.role === "user"
					? "ml-auto max-w-[78%] rounded-lg bg-white px-3 py-2 text-sm text-zinc-950"
					: "mr-auto max-w-[86%] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-zinc-100"
			}
		>
			<p className="whitespace-pre-wrap break-words">{message.text}</p>
			{message.streaming ? (
				<span className="mt-2 block text-xs text-zinc-500">Streaming</span>
			) : null}
		</article>
	)
}

function ActivityBubble({
	activity
}: {
	activity: AgentThread["activities"][number]
}): JSX.Element {
	const summary = activitySummary(activity)
	return (
		<article className="mr-auto max-w-[86%] rounded-lg border border-white/8 bg-neutral-900/70 px-3 py-2 text-xs text-neutral-400">
			<div className="flex items-center justify-between gap-3">
				<span className="font-mono text-[11px] text-neutral-500">{summary.label}</span>
				<span className="text-[10px] text-neutral-600">
					{new Date(activity.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit"
					})}
				</span>
			</div>
			<p className="mt-1 whitespace-pre-wrap break-words text-neutral-300">{summary.value}</p>
		</article>
	)
}

function activitySummary(activity: AgentThread["activities"][number]): {
	label: string
	value: string
} {
	if (activity.kind === "command.execution") {
		return { label: "ran command", value: activity.summary.replace(/^Ran command:\s*/i, "") }
	}
	if (activity.kind === "file.change") return { label: "edited files", value: "Changed files" }
	if (activity.kind === "tool.call") return { label: "called tool", value: activity.summary }
	return { label: "activity", value: activity.summary }
}
