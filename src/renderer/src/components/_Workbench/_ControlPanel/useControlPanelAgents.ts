import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { AgentRow } from "@renderer/types/models"
import type { CreateSide } from "./AgentCard"

const MODEL_BY_PROVIDER: Record<AgentRow["provider"], string> = {
	codex: "gpt-5.5",
	claude: "claude-opus-4-7"
}
const DEFAULT_EFFORT = "medium"
const TOPIC_WORD_LIMIT = 5
const NAME_STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"for",
	"in",
	"me",
	"of",
	"on",
	"the",
	"to",
	"with"
])

export interface StartAgentInput {
	provider: AgentRow["provider"]
	sourceAgentId?: string
	side?: CreateSide
}

export function useControlPanelAgents(
	workspaceId: string,
	workspacePath: string
): {
	agents: AgentRow[]
	createAgent: (input: StartAgentInput) => Promise<void>
	deleteAgent: (id: string) => Promise<void>
	deletingAgentId: string | null
	isCreatingAgent: boolean
	refetch: () => void
} {
	const { project } = useSessionData()
	const projectId = project?.id ?? ""
	const queryClient = useQueryClient()
	const { data: agents = [], refetch } = useQuery({
		queryKey: ["agents", projectId, workspaceId, workspacePath],
		queryFn: () => window.api.agents.list(projectId),
		enabled: Boolean(projectId)
	})
	const [isCreatingAgent, setIsCreatingAgent] = useState(false)
	const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null)

	async function createAgent(input: StartAgentInput): Promise<void> {
		if (!projectId || isCreatingAgent) return
		setIsCreatingAgent(true)
		try {
			const model = MODEL_BY_PROVIDER[input.provider]
			await window.api.agents.create({
				name: "New Agent",
				project_id: projectId,
				workspace_id: workspaceId,
				provider: input.provider,
				model,
				scope_path: workspacePath,
				effort: DEFAULT_EFFORT,
				...layoutForAgent(input, agents)
			})
			await refetch()
		} finally {
			setIsCreatingAgent(false)
		}
	}

	async function deleteAgent(id: string): Promise<void> {
		if (deletingAgentId) return
		setDeletingAgentId(id)
		try {
			await window.api.agents.delete(id)
			queryClient.removeQueries({ queryKey: ["tasks", id] })
			await refetch()
		} finally {
			setDeletingAgentId(null)
		}
	}

	return {
		agents,
		createAgent,
		deleteAgent,
		deletingAgentId,
		isCreatingAgent,
		refetch: () => void refetch()
	}
}

function layoutForAgent(
	input: StartAgentInput,
	agents: AgentRow[]
): { layout_x: number; layout_y: number } {
	const sourceAgent = agents.find((agent) => agent.id === input.sourceAgentId)
	if (!sourceAgent || !input.side) return { layout_x: 0, layout_y: 0 }
	const deltas: Record<CreateSide, { x: number; y: number }> = {
		left: { x: -1, y: 0 },
		right: { x: 1, y: 0 },
		top: { x: 0, y: -1 },
		bottom: { x: 0, y: 1 }
	}
	const delta = deltas[input.side]
	return {
		layout_x: sourceAgent.layout_x + delta.x,
		layout_y: sourceAgent.layout_y + delta.y
	}
}

export function agentNameForPrompt(prompt: string): string {
	const words = prompt.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []
	const topicWords = words.filter((word) => !NAME_STOP_WORDS.has(word)).slice(0, TOPIC_WORD_LIMIT)
	const selectedWords = topicWords.length > 0 ? topicWords : words.slice(0, TOPIC_WORD_LIMIT)
	const name = selectedWords.map(titleCase).join(" ")
	return name || "New Agent"
}

function titleCase(word: string): string {
	return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}
