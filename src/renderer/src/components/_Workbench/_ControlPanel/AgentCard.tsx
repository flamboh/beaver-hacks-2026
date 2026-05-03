import { Chat } from "@renderer/components/chat"
import { useAgentSnapshot } from "@renderer/agentStore"
import type { AgentRow } from "@renderer/types/models"
import TaskList from "./TaskList"
import { CARD_H, CARD_W } from "./controlPanelLayout"

function parseScopePath(path: string): string {
	if (!path) return ""
	const parts = path.replace(/\\/g, "/").split("/")
	return (
		parts.findLast((segment) => segment.endsWith(".md") || segment.endsWith(".txt")) ??
		parts.at(-1) ??
		""
	)
}

const PRIORITY_LEVELS = ["low", "medium", "high"] as const

const EFFORT_STYLES: Record<string, string> = {
	low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
	high: "bg-red-500/15 text-red-400 border-red-500/30"
}

interface Props {
	agent: AgentRow
	workspaceId: string
	workspacePath: string
}

export default function AgentCard({ agent, workspaceId, workspacePath }: Props) {
	const snapshot = useAgentSnapshot()
	const activeThread =
		snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId) ?? null
	const session = activeThread?.session ?? null
	const isRunning =
		session !== null &&
		(session.status === "starting" || session.status === "running" || session.activeTurnId !== null)

	const scopeDisplay = parseScopePath(agent.scope_path)

	return (
		<div
			className="flex flex-col overflow-hidden rounded-xl border border-white/8 bg-neutral-900 text-white shadow-2xl shadow-black/40"
			style={{ width: CARD_W, height: CARD_H }}
			onWheel={(event) => event.stopPropagation()}
		>
			<div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 bg-neutral-800/60 px-5">
				<span className="min-w-0 truncate text-sm font-semibold tracking-wide text-neutral-100">
					{agent.name}
				</span>
				<button className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-400 transition-all duration-150 hover:border-red-500/60 hover:bg-red-500/10">
					Terminate
				</button>
			</div>

			<div className="flex flex-1 overflow-hidden">
				<div className="flex w-[35%] shrink-0 flex-col gap-5 border-r border-white/5 px-4 py-4">
					<TaskList />

					<div className="flex flex-col gap-1">
						<span className="text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
							Model
						</span>
						<span className="break-words font-mono text-xs text-neutral-400">{agent.model}</span>
					</div>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
						<div className="flex items-center gap-1">
							{PRIORITY_LEVELS.map((level) => (
								<span
									key={level}
									className={`rounded-md border px-2 py-0.5 text-[11px] capitalize transition-colors ${
										agent.effort === level
											? EFFORT_STYLES[level]
											: "border-white/5 bg-transparent text-neutral-700"
									}`}
								>
									{level}
								</span>
							))}
						</div>
						{scopeDisplay ? (
							<span className="min-w-0 truncate text-xs text-neutral-600">
								Scope: <span className="font-mono text-blue-400/80">{scopeDisplay}</span>
							</span>
						) : null}
					</div>

					<div className="min-h-0 flex-1">
						<Chat
							thread={activeThread}
							isRunning={isRunning}
							cwd={workspacePath}
							workspaceId={workspaceId}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
