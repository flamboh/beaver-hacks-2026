import { Chat } from "@renderer/components/chat"
import { useAgentSnapshot } from "@renderer/agentStore"
import type { AgentRow } from "@renderer/types/models"
import TaskList from "./TaskList"

function parseScopePath(p: string): string {
	if (!p) return ""
	const parts = p.replace(/\\/g, "/").split("/")
	return parts.findLast((s) => s.endsWith(".md") || s.endsWith(".txt")) ?? parts[parts.length - 1]
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
	const activeThread = snapshot.threads.find((t) => t.id === snapshot.activeThreadId) ?? null
	const session = activeThread?.session ?? null
	const isRunning =
		session !== null &&
		(session.status === "starting" || session.status === "running" || session.activeTurnId !== null)

	const scopeDisplay = parseScopePath(agent.scope_path)

	return (
		<div
			className="flex flex-col rounded-xl border border-white/8 bg-neutral-900 text-white overflow-hidden shadow-2xl shadow-black/40"
			style={{ width: 1000, height: 600 }}
		>
			{/* header */}
			<div className="flex items-center justify-between px-5 h-11 border-b border-white/5 bg-neutral-800/60 shrink-0">
				<span className="text-sm font-semibold tracking-wide text-neutral-100">{agent.name}</span>
				<button className="text-xs px-2.5 py-1 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-150">
					Terminate
				</button>
			</div>

			{/* body */}
			<div className="flex flex-1 overflow-hidden">
				{/* left panel */}
				<div className="flex flex-col w-[35%] shrink-0 border-r border-white/5 px-4 py-4 gap-5">
					<TaskList />

					<div className="flex flex-col gap-1">
						<span className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
							Model
						</span>
						<span className="text-xs text-neutral-400 font-mono">{agent.model}</span>
					</div>
				</div>

				{/* right panel */}
				<div className="flex flex-col flex-1 overflow-hidden">
					<div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
						<div className="flex items-center gap-1">
							{PRIORITY_LEVELS.map((level) => (
								<span
									key={level}
									className={`text-[11px] px-2 py-0.5 rounded-md border capitalize transition-colors ${
										agent.effort === level
											? EFFORT_STYLES[level]
											: "border-white/5 text-neutral-700 bg-transparent"
									}`}
								>
									{level}
								</span>
							))}
						</div>
						{scopeDisplay && (
							<span className="text-xs text-neutral-600">
								Scope: <span className="text-blue-400/80 font-mono">{scopeDisplay}</span>
							</span>
						)}
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
