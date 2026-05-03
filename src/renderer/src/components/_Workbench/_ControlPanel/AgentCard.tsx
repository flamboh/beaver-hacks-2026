import { useMemo } from "react"
import { Chat } from "@renderer/components/chat"
import { GitCommitMenu } from "@renderer/components/GitCommitMenu"
import { useAgentSnapshot } from "@renderer/agentStore"

// ── placeholder data ──────────────────────────────────────────────
const AGENT_NAME = "Agent One"
const MODEL_NAME = "claude-opus-4-7"
const CURRENT_TASK =
	"Refactor the authentication middleware to meet the new compliance requirements."
const PRIORITY: "low" | "medium" | "high" = "medium"
const SCOPE = "@Pipeline.md"
const TASK_LIST = [
	"Research existing auth patterns",
	"Draft new session token schema",
	"Implement middleware changes",
	"Write integration tests"
]
// ─────────────────────────────────────────────────────────────────

const PRIORITY_LEVELS = ["low", "medium", "high"] as const

const priorityStyles: Record<(typeof PRIORITY_LEVELS)[number], string> = {
	low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	medium: "bg-yellow-500/15  text-yellow-400  border-yellow-500/30",
	high: "bg-red-500/15     text-red-400     border-red-500/30"
}

interface AgentCardProps {
	projectCwd: string
}

export default function AgentCard({ projectCwd }: AgentCardProps) {
	const snapshot = useAgentSnapshot()
	const activeThread = useMemo(
		() =>
			snapshot.threads.find(
				(thread) => thread.id === snapshot.activeThreadId && thread.cwd === projectCwd
			) ??
			snapshot.threads
				.slice()
				.reverse()
				.find((thread) => thread.cwd === projectCwd) ??
			null,
		[projectCwd, snapshot]
	)
	const sessionStatus = activeThread?.session?.status ?? "idle"
	const isRunning = sessionStatus === "starting" || sessionStatus === "running"

	return (
		<div
			className="flex flex-col rounded-xl border border-white/8 bg-neutral-900 text-white overflow-hidden shadow-2xl shadow-black/40"
			style={{ width: 820, height: 500 }}
			onMouseDown={(event) => event.stopPropagation()}
			onMouseMove={(event) => event.stopPropagation()}
			onWheel={(event) => event.stopPropagation()}
		>
			{/* header */}
			<div className="flex items-center justify-between px-5 h-11 border-b border-white/5 bg-neutral-800/60 shrink-0">
				<span className="text-sm font-semibold tracking-wide text-neutral-100">{AGENT_NAME}</span>
				<div className="flex items-center gap-2">
					<span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-500">
						{sessionStatus}
					</span>
					<GitCommitMenu cwd={activeThread?.cwd ?? projectCwd} />
					<button className="text-xs px-2.5 py-1 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-150">
						Terminate
					</button>
				</div>
			</div>

			{/* body */}
			<div className="flex flex-1 overflow-hidden">
				{/* left panel */}
				<div className="flex flex-col w-64 shrink-0 border-r border-white/5 px-4 py-4 gap-5">
					<div className="flex flex-col gap-1.5">
						<span className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
							Current Task
						</span>
						<div className="rounded-lg bg-neutral-800/60 border border-white/5 px-3 py-2.5 text-sm text-neutral-300 leading-relaxed">
							{CURRENT_TASK}
						</div>
					</div>

					<div className="flex flex-col gap-1.5 flex-1">
						<span className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
							Task List
						</span>
						<ol className="flex flex-col gap-1.5">
							{TASK_LIST.map((task, i) => (
								<li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
									<span className="text-neutral-700 tabular-nums shrink-0 mt-px">{i + 1}.</span>
									<span className="leading-snug">{task}</span>
								</li>
							))}
						</ol>
					</div>

					<div className="flex flex-col gap-1">
						<span className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
							Model
						</span>
						<span className="text-xs text-neutral-400 font-mono">{MODEL_NAME}</span>
					</div>
				</div>

				{/* right panel */}
				<div className="flex flex-col flex-1 px-4 py-4 gap-3">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-1">
							{PRIORITY_LEVELS.map((level) => (
								<span
									key={level}
									className={`text-[11px] px-2 py-0.5 rounded-md border capitalize transition-colors
                    ${
											PRIORITY === level
												? priorityStyles[level]
												: "border-white/5 text-neutral-700 bg-transparent"
										}`}
								>
									{level}
								</span>
							))}
						</div>
						<span className="text-xs text-neutral-600">
							Scope: <span className="text-blue-400/80 font-mono">{SCOPE}</span>
						</span>
					</div>

					{/* chat */}
					<div className="flex flex-col flex-1 rounded-lg border border-white/5 bg-neutral-950 overflow-hidden">
						<div className="flex items-center gap-1.5 px-3 h-8 border-b border-white/5 bg-neutral-900/60 shrink-0">
							<span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
							<span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
							<span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
							<span className="ml-2 text-[10px] text-neutral-700 font-mono">chat</span>
						</div>
						<div className="min-h-0 flex-1">
							<Chat thread={activeThread} isRunning={isRunning} cwd={projectCwd} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
