import { useMemo } from "react"
import { useAgentSnapshot } from "@renderer/agentStore"
import type { AgentRow } from "@renderer/types/models"
import type { AgentSnapshot } from "../../../../../main/agent/ipc"
import { PLACEHOLDER_AGENTS } from "./controlPanelLayout"

type AgentThread = AgentSnapshot["threads"][number]

export function useControlPanelAgents(workspacePath: string): {
	agents: AgentRow[]
	threads: AgentThread[]
} {
	const snapshot = useAgentSnapshot()
	const threads = useMemo(
		() => snapshot.threads.filter((thread) => thread.cwd === workspacePath),
		[snapshot.threads, workspacePath]
	)
	const agents = useMemo<AgentRow[]>(
		() =>
			threads.length > 0
				? threads.map((thread) => ({
						id: thread.id,
						name: thread.title,
						project_id: "",
						model: thread.model ?? "codex",
						scope_path: thread.cwd,
						effort: "medium"
					}))
				: PLACEHOLDER_AGENTS,
		[threads]
	)
	return { agents, threads }
}
