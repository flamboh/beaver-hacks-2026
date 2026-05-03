import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { motion } from "motion/react"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSessionData } from "@renderer/hooks/useSessionData"
import { spawnAgentThread } from "@renderer/agentStore"
import type { AgentRow } from "@renderer/types/models"
import AgentsSidebar, { type AgentStatus } from "../AgentsSidebar"
import NewAgentModal, { type NewAgentInput } from "../NewAgentModal"
import { summarizeTasks, type AgentTaskSummary } from "./agentTaskSummary"

type AgentCardRow = AgentRow & {
	current_task: string
	status: AgentStatus
	taskSummary: AgentTaskSummary
}

type AgentProvider = "claudeCode" | "codex"

const STATUS_ORDER: Record<AgentStatus, number> = {
	failure: 0,
	working: 1,
	pending: 2,
	idle: 3
}

const EFFORT_STYLES: Record<string, string> = {
	low: "border-white/10 bg-white/8 text-neutral-200",
	medium: "border-white/10 bg-white/8 text-neutral-200",
	high: "border-white/10 bg-white/8 text-neutral-200"
}

const STATUS_STYLES: Record<AgentStatus, string> = {
	failure: "bg-red-500",
	pending: "bg-orange-400",
	working: "bg-blue-500",
	idle: "bg-neutral-500"
}

const STATUS_BORDER_STYLES: Record<AgentStatus, string> = {
	failure: "border-red-500/80",
	pending: "border-orange-400/80",
	working: "border-blue-500/80",
	idle: "border-neutral-400/70"
}

function agentImage(agent: AgentCardRow) {
	const isClaude = agent.model.includes("claude")
	return {
		label: isClaude ? "Claude Code" : "Codex",
		provider: (isClaude ? "claudeCode" : "codex") as AgentProvider
	}
}

function AgentLogo({ label, provider }: { label: string; provider: AgentProvider }) {
	if (provider === "claudeCode") {
		return (
			<svg role="img" aria-label={label} viewBox="0 0 24 24" className="h-16 w-16">
				<path
					clipRule="evenodd"
					d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
					fill="#D97757"
					fillRule="evenodd"
				/>
			</svg>
		)
	}

	return (
		<svg role="img" aria-label={label} viewBox="0 0 24 24" className="h-18 w-18">
			<path
				d="M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z"
				fill="url(#codex-logo-gradient)"
			/>
			<defs>
				<linearGradient
					gradientUnits="userSpaceOnUse"
					id="codex-logo-gradient"
					x1="12"
					x2="12"
					y1="3"
					y2="21"
				>
					<stop stopColor="#B1A7FF" />
					<stop offset=".5" stopColor="#7A9DFF" />
					<stop offset="1" stopColor="#3941FF" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default function Agents({ projectPath }: { projectPath: string }) {
	const { project } = useSessionData()
	const projectId = project?.id ?? ""
	const queryClient = useQueryClient()

	const { data: dbAgents = [] } = useQuery({
		queryKey: ["agents", projectId],
		queryFn: () => window.api.agents.list(projectId),
		enabled: !!projectId
	})

	const taskQueries = useQueries({
		queries: dbAgents.map((agent) => ({
			queryKey: ["tasks", agent.id],
			queryFn: () => window.api.tasks.list(agent.id),
			enabled: !!projectId && !!agent.id
		}))
	})

	const agents = useMemo<AgentCardRow[]>(
		() =>
			[...dbAgents]
				.map((agent, index) => {
					const summary = summarizeTasks(taskQueries[index]?.data ?? [])
					return {
						...agent,
						status: summary.status,
						current_task: summary.current_task,
						taskSummary: summary
					}
				})
				.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
		[dbAgents, taskQueries]
	)

	const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false)
	const [editingAgent, setEditingAgent] = useState<AgentCardRow | null>(null)
	const [hoveredStatus, setHoveredStatus] = useState<AgentStatus | null>(null)

	const statusCounts = agents.reduce<Record<AgentStatus, number>>(
		(counts, agent) => ({
			...counts,
			[agent.status]: counts[agent.status] + 1
		}),
		{ failure: 0, pending: 0, working: 0, idle: 0 }
	)

	const handleCreateAgent = async (input: NewAgentInput) => {
		const created = await window.api.agents.create({
			name: input.name || "Unnamed Agent",
			project_id: projectId,
			model: input.model,
			scope_path: input.scopePath,
			effort: input.effort
		})
		void queryClient.invalidateQueries({ queryKey: ["agents", projectId] })
		void spawnAgentThread({
			threadId: created.id,
			cwd: project?.path ?? projectPath,
			name: created.name,
			model: created.model
		})
	}

	const handleUpdateAgent = async (): Promise<void> => {
		// TODO: wire DB update once agent update API is implemented
	}

	return (
		<div className="flex h-full overflow-hidden">
			<AgentsSidebar total={agents.length} counts={statusCounts} onStatusHover={setHoveredStatus} />

			<div className="flex flex-1 flex-col overflow-auto pl-6">
				<div className="mb-6 flex items-center justify-between">
					<div>
						<h2 className="text-base font-semibold text-white">Agents</h2>
						<p className="mt-0.5 text-xs text-neutral-500">{agents.length} configured</p>
					</div>
					<button
						onClick={() => setIsNewAgentModalOpen(true)}
						className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/8 px-3 py-1.5 text-sm text-white transition-colors duration-300 hover:bg-white/12"
					>
						<Plus size={14} />
						New Agent
					</button>
				</div>

				{agents.length === 0 ? (
					<div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
						No agents yet. Create one to get started.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
						{agents.map((agent, index) => {
							const image = agentImage(agent)
							return (
								<motion.button
									type="button"
									key={agent.id}
									initial={{ opacity: 0, y: 32 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										delay: index * 0.045,
										duration: 0.9,
										ease: [0.22, 1, 0.36, 1]
									}}
									onClick={() => setEditingAgent(agent)}
									className={`group relative min-w-0 cursor-pointer rounded-lg border bg-neutral-900 p-4 text-left transition-colors duration-300 hover:border-white/20 ${
										hoveredStatus === agent.status
											? STATUS_BORDER_STYLES[agent.status]
											: "border-white/5"
									}`}
								>
									<div className="relative mb-4 flex aspect-[16/9] items-center justify-center rounded-md border border-white/8 bg-neutral-950">
										<span
											className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${STATUS_STYLES[agent.status]}`}
											aria-label={`${agent.status} status`}
										/>
										<AgentLogo provider={image.provider} label={image.label} />
									</div>

									<div className="flex min-w-0 flex-col gap-1.5">
										<div className="flex items-center justify-between gap-3">
											<span className="truncate text-sm font-medium text-neutral-100">
												{agent.name}
											</span>
											<span
												className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] capitalize ${EFFORT_STYLES[agent.effort]}`}
											>
												{agent.effort}
											</span>
										</div>
										<span className="truncate font-mono text-xs text-neutral-500">
											{agent.model}
										</span>
										<span className="truncate font-mono text-xs text-blue-400/70">
											{agent.scope_path}
										</span>
										{agent.current_task ? (
											<span className="truncate text-xs text-neutral-400">
												{agent.current_task}
											</span>
										) : null}
									</div>
								</motion.button>
							)
						})}
					</div>
				)}
			</div>

			{isNewAgentModalOpen ? (
				<NewAgentModal
					onCancel={() => setIsNewAgentModalOpen(false)}
					onSubmit={handleCreateAgent}
					projectPath={projectPath}
				/>
			) : null}

			{editingAgent ? (
				<NewAgentModal
					initialAgent={editingAgent}
					onCancel={() => setEditingAgent(null)}
					onSubmit={handleUpdateAgent}
					projectPath={projectPath}
				/>
			) : null}
		</div>
	)
}
