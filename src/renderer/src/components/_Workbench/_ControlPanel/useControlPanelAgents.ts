import { useQuery } from "@tanstack/react-query"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { AgentRow } from "@renderer/types/models"

export function useControlPanelAgents(
	workspaceId: string,
	workspacePath: string
): {
	agents: AgentRow[]
	refetch: () => void
} {
	const { project } = useSessionData()
	const projectId = project?.id ?? ""
	const { data: agents = [], refetch } = useQuery({
		queryKey: ["agents", projectId, workspaceId, workspacePath],
		queryFn: () => window.api.agents.list(projectId),
		enabled: Boolean(projectId)
	})
	return { agents, refetch: () => void refetch() }
}
