import { useState } from "react"
import { Plus } from "lucide-react"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { AgentRow } from "@renderer/types/models"
import NewAgentModal, { type NewAgentInput } from "../NewAgentModal"

// ── placeholder data ──────────────────────────────────────────────
const PLACEHOLDER_AGENTS: AgentRow[] = [
	{
		id: "1",
		name: "Auth Refactor",
		project_id: "proj-1",
		model: "claude-opus-4-7",
		scope_path: "@Pipeline.md",
		effort: "high"
	},
	{
		id: "2",
		name: "Test Coverage",
		project_id: "proj-1",
		model: "gpt-4o-mini",
		scope_path: "@tests/README.md",
		effort: "medium"
	},
	{
		id: "3",
		name: "Docs Generator",
		project_id: "proj-1",
		model: "claude-sonnet-4-6",
		scope_path: "",
		effort: "low"
	}
]

// const PLACEHOLDER_TASK =
// 	"Refactoring the authentication middleware to meet the new compliance requirements..."

const EFFORT_STYLES: Record<string, string> = {
	low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	medium: "bg-yellow-500/15  text-yellow-400  border-yellow-500/30",
	high: "bg-red-500/15     text-red-400     border-red-500/30"
}

// ─────────────────────────────────────────────────────────────────

export default function Agents() {
	const { project } = useSessionData()
	const [agents, setAgents] = useState<AgentRow[]>(PLACEHOLDER_AGENTS)
	const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false)

	const handleCreateAgent = async (input: NewAgentInput) => {
		// simulate DB write
		await new Promise((res) => setTimeout(res, 900))
		const newAgent: AgentRow = {
			id: crypto.randomUUID(),
			name: input.name || "Unnamed Agent",
			project_id: project?.id ?? "",
			model: input.model,
			scope_path: input.instructionMode === "path" ? input.scopePath : "",
			effort: input.effort
		}
		setAgents((prev) => [newAgent, ...prev])
	}

	return (
		<div className="flex h-full overflow-hidden">
			{/* main list */}
			<div className="flex flex-col flex-1 overflow-auto">
				{/* header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-base font-semibold text-white">Agents</h2>
						<p className="text-xs text-neutral-500 mt-0.5">{agents.length} configured</p>
					</div>
					<button
						onClick={() => setIsNewAgentModalOpen(true)}
						className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/8 px-3 py-1.5 text-sm text-white transition-colors duration-300 hover:bg-white/12"
					>
						<Plus size={14} />
						New Agent
					</button>
				</div>

				{/* agent cards */}
				{agents.length === 0 ? (
					<div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
						No agents yet. Create one to get started.
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{agents.map((agent) => (
							<div
								key={agent.id}
								className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/5 bg-neutral-900 hover:border-white/10 transition-colors duration-150"
							>
								<div className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-neutral-100">{agent.name}</span>
									<span className="text-xs text-neutral-500 font-mono">{agent.model}</span>
									{agent.scope_path && (
										<span className="text-xs text-blue-400/70 font-mono">{agent.scope_path}</span>
									)}
								</div>
								<span
									className={`text-[11px] px-2 py-0.5 rounded-md border capitalize ${EFFORT_STYLES[agent.effort]}`}
								>
									{agent.effort}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			{isNewAgentModalOpen && (
				<NewAgentModal
					onCancel={() => setIsNewAgentModalOpen(false)}
					onCreate={handleCreateAgent}
				/>
			)}
		</div>
	)
}
