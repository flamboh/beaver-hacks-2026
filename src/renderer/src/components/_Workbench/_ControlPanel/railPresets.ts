import type { ControlPanelCard, StartCardInput } from "./useControlPanelAgents"

export const RAIL_PRESETS_STORAGE_KEY = "beaver.railPresets.v1"

export interface RailPreset {
	id: string
	name: string
	items: StartCardInput[]
}

export function readRailPresets(): RailPreset[] {
	try {
		const raw = localStorage.getItem(RAIL_PRESETS_STORAGE_KEY)
		return raw ? (JSON.parse(raw) as RailPreset[]) : []
	} catch {
		return []
	}
}

export function writeRailPresets(presets: RailPreset[]): void {
	localStorage.setItem(RAIL_PRESETS_STORAGE_KEY, JSON.stringify(presets))
}

export function presetItemsForCards(
	cards: ControlPanelCard[],
	workspaceId: string
): StartCardInput[] {
	return cards
		.filter((card) => card.workspace_id === workspaceId)
		.sort((a, b) => a.layout_x - b.layout_x)
		.map<StartCardInput>((card) =>
			card.kind === "tool"
				? { kind: "tool", tool: card.tool }
				: { kind: "agent", provider: card.provider }
		)
}
