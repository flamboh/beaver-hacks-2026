import { useMemo, useState } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import type { AgentRow } from "@renderer/types/models"
import type { CreateSide } from "./AgentCard"
import type { WorkspaceRow } from "src/main/db/contracts"

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

export type WorkspaceLane = WorkspaceRow & {
	projectName: string
	projectPath: string
	projectEnterDevAction: string
}

export interface StartAgentInput {
	kind: "agent"
	provider: AgentRow["provider"]
	sourceCardId?: string
	side?: CreateSide
}

export interface StartToolInput {
	kind: "tool"
	tool: "terminal" | "browser"
	sourceCardId?: string
	side?: CreateSide
}

export type StartCardInput = StartAgentInput | StartToolInput

export interface ToolCard {
	id: string
	kind: "tool"
	tool: "terminal" | "browser"
	layout_x: number
	layout_y: number
	workspace_id: string
	projectId: string
	projectName: string
	projectPath: string
	enterDevAction: string
	workspaceName: string
	workspacePath: string
}

export type ControlPanelCard =
	| ({
			kind: "agent"
			workspace_id: string
			projectId: string
			projectName: string
			projectPath: string
			enterDevAction: string
			workspaceName: string
			workspacePath: string
	  } & AgentRow)
	| ToolCard

export function useControlPanelAgents(
	projectIds: string[],
	workspaces: WorkspaceLane[],
	activeWorkspaceId: string
): {
	cards: ControlPanelCard[]
	createCard: (input: StartCardInput) => Promise<void>
	deleteCard: (id: string) => Promise<void>
	deletingCardId: string | null
	isCreatingCard: boolean
	refetch: () => void
} {
	const queryClient = useQueryClient()
	const agentQueries = useQueries({
		queries: projectIds.map((projectId) => ({
			queryKey: ["agents", projectId],
			queryFn: () => window.api.agents.list(projectId),
			enabled: Boolean(projectId)
		}))
	})
	const toolCardQueries = useQueries({
		queries: projectIds.map((projectId) => ({
			queryKey: ["tool-cards", projectId],
			queryFn: () => window.api.toolCards.list(projectId),
			enabled: Boolean(projectId)
		}))
	})
	const agents = agentQueries.flatMap((query) => query.data ?? [])
	const persistedToolCards = toolCardQueries.flatMap((query) => query.data ?? [])
	const refetchCards = () =>
		Promise.all([...agentQueries, ...toolCardQueries].map((query) => query.refetch()))
	const [isCreatingCard, setIsCreatingCard] = useState(false)
	const [deletingCardId, setDeletingCardId] = useState<string | null>(null)
	const laneByWorkspaceId = useMemo(
		() => new Map(workspaces.map((workspace, index) => [workspace.id, { index, workspace }])),
		[workspaces]
	)
	const cards = useMemo<ControlPanelCard[]>(() => {
		const agentCards = agents.flatMap((agent) => {
			if (!agent.workspace_id) return []
			const lane = laneByWorkspaceId.get(agent.workspace_id)
			if (!lane) return []
			return [
				{
					...agent,
					kind: "agent" as const,
					workspace_id: agent.workspace_id,
					projectId: lane.workspace.projectId,
					projectName: lane.workspace.projectName,
					projectPath: lane.workspace.projectPath,
					enterDevAction: lane.workspace.projectEnterDevAction,
					workspaceName: lane.workspace.name,
					workspacePath: lane.workspace.path,
					layout_y: lane.index
				}
			]
		})
		const toolCards = persistedToolCards.flatMap((card) => {
			const lane = laneByWorkspaceId.get(card.workspace_id)
			if (!lane) return []
			return [
				{
					id: card.id,
					kind: "tool" as const,
					tool: card.kind,
					workspace_id: card.workspace_id,
					projectId: lane.workspace.projectId,
					projectName: lane.workspace.projectName,
					projectPath: lane.workspace.projectPath,
					enterDevAction: lane.workspace.projectEnterDevAction,
					workspaceName: lane.workspace.name,
					workspacePath: lane.workspace.path,
					layout_x: card.layout_x,
					layout_y: lane.index
				}
			]
		})
		return [...agentCards, ...toolCards].sort((a, b) => {
			if (a.layout_y !== b.layout_y) return a.layout_y - b.layout_y
			return a.layout_x - b.layout_x
		})
	}, [agents, laneByWorkspaceId, persistedToolCards])

	async function createCard(input: StartCardInput): Promise<void> {
		if (isCreatingCard) return
		setIsCreatingCard(true)
		try {
			const sourceCard = cards.find((card) => card.id === input.sourceCardId)
			const workspaceId = sourceCard?.workspace_id ?? activeWorkspaceId
			const lane = laneByWorkspaceId.get(workspaceId)
			if (!lane) return
			const laneCards = cards.filter((card) => card.workspace_id === workspaceId)
			const layout = layoutForCard(input, laneCards, lane.index)
			if (input.kind === "tool") {
				await window.api.toolCards.create({
					project_id: lane.workspace.projectId,
					workspace_id: workspaceId,
					kind: input.tool,
					layout_x: layout.layout_x,
					layout_y: 0
				})
				await refetchCards()
				return
			}
			const model = MODEL_BY_PROVIDER[input.provider]
			await window.api.agents.create({
				name: "New Agent",
				project_id: lane.workspace.projectId,
				workspace_id: workspaceId,
				provider: input.provider,
				model,
				scope_path: lane.workspace.path,
				effort: DEFAULT_EFFORT,
				layout_x: layout.layout_x,
				layout_y: 0
			})
			await refetchCards()
		} finally {
			setIsCreatingCard(false)
		}
	}

	async function deleteCard(id: string): Promise<void> {
		if (deletingCardId) return
		setDeletingCardId(id)
		try {
			if (id.startsWith("tool:")) {
				await window.api.toolCards.delete(id)
				await refetchCards()
				return
			}
			await window.api.agents.delete(id)
			queryClient.removeQueries({ queryKey: ["tasks", id] })
			await refetchCards()
		} finally {
			setDeletingCardId(null)
		}
	}

	return {
		cards,
		createCard,
		deleteCard,
		deletingCardId,
		isCreatingCard,
		refetch: () => void refetchCards()
	}
}

function layoutForCard(
	input: StartCardInput,
	cards: ControlPanelCard[],
	laneIndex: number
): { layout_x: number; layout_y: number } {
	const sourceCard = cards.find((card) => card.id === input.sourceCardId)
	if (!sourceCard || !input.side) return nextLaneOrigin(cards, laneIndex)
	const deltas: Record<CreateSide, { x: number; y: number }> = {
		left: { x: -1, y: 0 },
		right: { x: 1, y: 0 },
		top: { x: 0, y: 0 },
		bottom: { x: 0, y: 0 }
	}
	const delta = deltas[input.side]
	return {
		layout_x: sourceCard.layout_x + delta.x,
		layout_y: laneIndex
	}
}

function nextLaneOrigin(
	cards: ControlPanelCard[],
	laneIndex: number
): { layout_x: number; layout_y: number } {
	if (cards.length === 0) return { layout_x: 0, layout_y: laneIndex }
	const maxX = cards.reduce((current, card) => Math.max(current, card.layout_x), -1)
	return { layout_x: maxX + 1, layout_y: laneIndex }
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
