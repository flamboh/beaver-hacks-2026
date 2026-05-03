import { useMemo, useState } from "react"
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
}

export type ControlPanelCard = ({ kind: "agent" } & AgentRow) | ToolCard

export function useControlPanelAgents(
	workspaceId: string,
	workspacePath: string
): {
	cards: ControlPanelCard[]
	createCard: (input: StartCardInput) => Promise<void>
	deleteCard: (id: string) => Promise<void>
	deletingCardId: string | null
	isCreatingCard: boolean
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
	const [toolCards, setToolCards] = useState<ToolCard[]>([])
	const [isCreatingCard, setIsCreatingCard] = useState(false)
	const [deletingCardId, setDeletingCardId] = useState<string | null>(null)
	const cards = useMemo<ControlPanelCard[]>(
		() =>
			[...agents.map((agent) => ({ ...agent, kind: "agent" as const })), ...toolCards].sort(
				(a, b) => {
					if (a.layout_y !== b.layout_y) return a.layout_y - b.layout_y
					return a.layout_x - b.layout_x
				}
			),
		[agents, toolCards]
	)

	async function createCard(input: StartCardInput): Promise<void> {
		if (isCreatingCard) return
		setIsCreatingCard(true)
		try {
			const layout = layoutForCard(input, cards)
			if (input.kind === "tool") {
				setToolCards((previous) => [
					...previous,
					{
						id: `tool:${input.tool}:${crypto.randomUUID()}`,
						kind: "tool",
						tool: input.tool,
						...layout
					}
				])
				return
			}
			if (!projectId) return
			const model = MODEL_BY_PROVIDER[input.provider]
			await window.api.agents.create({
				name: "New Agent",
				project_id: projectId,
				workspace_id: workspaceId,
				provider: input.provider,
				model,
				scope_path: workspacePath,
				effort: DEFAULT_EFFORT,
				...layout
			})
			await refetch()
		} finally {
			setIsCreatingCard(false)
		}
	}

	async function deleteCard(id: string): Promise<void> {
		if (deletingCardId) return
		setDeletingCardId(id)
		try {
			if (id.startsWith("tool:")) {
				setToolCards((previous) => previous.filter((card) => card.id !== id))
				return
			}
			await window.api.agents.delete(id)
			queryClient.removeQueries({ queryKey: ["tasks", id] })
			await refetch()
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
		refetch: () => void refetch()
	}
}

function layoutForCard(
	input: StartCardInput,
	cards: ControlPanelCard[]
): { layout_x: number; layout_y: number } {
	const sourceCard = cards.find((card) => card.id === input.sourceCardId)
	if (!sourceCard || !input.side) return nextGridOrigin(cards)
	const deltas: Record<CreateSide, { x: number; y: number }> = {
		left: { x: -1, y: 0 },
		right: { x: 1, y: 0 },
		top: { x: 0, y: -1 },
		bottom: { x: 0, y: 1 }
	}
	const delta = deltas[input.side]
	return {
		layout_x: sourceCard.layout_x + delta.x,
		layout_y: sourceCard.layout_y + delta.y
	}
}

function nextGridOrigin(cards: ControlPanelCard[]): { layout_x: number; layout_y: number } {
	const maxY = cards.reduce((current, card) => Math.max(current, card.layout_y), -1)
	const firstRowHasSlot =
		!cards.some((card) => card.layout_x === 0 && card.layout_y === 0) ||
		!cards.some((card) => card.layout_x === 1 && card.layout_y === 0)
	if (cards.length === 0) return { layout_x: 0, layout_y: 0 }
	if (firstRowHasSlot) {
		if (!cards.some((card) => card.layout_x === 0 && card.layout_y === 0))
			return { layout_x: 0, layout_y: 0 }
		if (!cards.some((card) => card.layout_x === 1 && card.layout_y === 0))
			return { layout_x: 1, layout_y: 0 }
	}
	return { layout_x: 0, layout_y: maxY + 1 }
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
