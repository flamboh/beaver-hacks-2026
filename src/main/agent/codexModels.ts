import type { AgentModelOption } from "./contracts"

export const DEFAULT_CODEX_MODEL = "gpt-5.5"

export interface CodexModelListResponse {
	data?: CodexModelListItem[]
	nextCursor?: string | null
}

interface CodexModelListItem {
	additionalSpeedTiers?: string[]
	defaultReasoningEffort?: string
	displayName?: string
	hidden?: boolean
	isDefault?: boolean
	model?: string
	id?: string
	supportedReasoningEfforts?: Array<{
		description?: string
		reasoningEffort?: string
	}>
}

export function codexModelOption(model: CodexModelListItem): AgentModelOption | null {
	const id = model.model ?? model.id
	if (!id || model.hidden) return null
	return {
		id,
		label: model.displayName ?? id,
		provider: "codex",
		isDefault: model.isDefault ?? id === DEFAULT_CODEX_MODEL,
		reasoningEfforts: (model.supportedReasoningEfforts ?? []).flatMap((effort) => {
			const effortId = effort.reasoningEffort
			if (!effortId) return []
			return [
				{
					id: effortId,
					label: runSettingLabel(effortId),
					description: effort.description ?? null,
					isDefault: effortId === model.defaultReasoningEffort
				}
			]
		}),
		speedTiers: (model.additionalSpeedTiers ?? []).filter(supportedServiceTier).map((tier) => ({
			id: tier,
			label: runSettingLabel(tier),
			description: null,
			isDefault: false
		}))
	}
}

export function fallbackCodexModels(): AgentModelOption[] {
	return [
		{
			id: DEFAULT_CODEX_MODEL,
			label: "GPT-5.5",
			provider: "codex",
			isDefault: true,
			reasoningEfforts: [],
			speedTiers: []
		}
	]
}

function runSettingLabel(id: string): string {
	if (id === "xhigh") return "X High"
	return id
		.split(/[-_]/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")
}

function supportedServiceTier(id: string): boolean {
	return id === "fast" || id === "flex"
}
