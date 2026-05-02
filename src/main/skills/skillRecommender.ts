import type { AgentSkillSuggestion } from "../agent/contracts"
import { listInstalledSkillKeys, matchesInstalledSkill } from "./installedSkills"
import { buildProjectSkillProfile, type ProjectSkillProfile } from "./projectProfile"
import { readProjectFiles } from "./projectFiles"
import { searchMarketplaceSkills, type MarketplaceSkill } from "./skillsMarketplace"

export interface ProjectSkillRecommendation {
	profile: ProjectSkillProfile
	suggestions: AgentSkillSuggestion[]
	marketplaceError: string | null
}

export interface SkillRecommenderOptions {
	runCodexPrompt?: (input: { prompt: string; model: string }) => Promise<string>
}

const MAX_QUERIES = 4
const MAX_SUGGESTIONS = 8

function rankSkill(
	skill: MarketplaceSkill,
	profile: ProjectSkillProfile,
	installed: boolean
): number {
	const haystack = `${skill.name} ${skill.slug} ${skill.source}`.toLowerCase()
	const domainMatches = profile.domains.filter((domain) =>
		haystack.includes(domain.toLowerCase().split(" ")[0])
	).length
	const sourceBoost = ["vercel-labs", "openai", "anthropics", "microsoft"].some((source) =>
		skill.source.includes(source)
	)
		? 8
		: 0

	return Math.round(
		Math.log10(skill.installs + 1) * 10 + domainMatches * 12 + sourceBoost + (installed ? 20 : 0)
	)
}

export async function recommendProjectSkills(
	cwd: string,
	prompt: string,
	options: SkillRecommenderOptions = {}
): Promise<ProjectSkillRecommendation> {
	const files = await readProjectFiles(cwd)
	const profile = await buildProjectSkillProfile(files, prompt, options.runCodexPrompt)
	const installedKeys = await listInstalledSkillKeys(cwd)
	const queries = Array.from(new Set(profile.searchQueries)).slice(0, MAX_QUERIES)
	const searchResults = await Promise.all(queries.map(searchMarketplaceSkills))
	const results = searchResults.flatMap((result) => result.skills)
	const marketplaceError = searchResults.find((result) => result.error)?.error ?? null
	const byId = new Map<string, MarketplaceSkill>()

	for (const skill of results) {
		byId.set(skill.id, skill)
	}

	const suggestions = Array.from(byId.values())
		.map((skill) => {
			const installed = matchesInstalledSkill(installedKeys, skill)
			return {
				id: skill.id,
				slug: skill.slug,
				name: skill.name,
				source: skill.source,
				installs: skill.installs,
				sourceType: skill.sourceType,
				installUrl: skill.installUrl,
				url: skill.url,
				description: skill.description,
				score: rankSkill(skill, profile, installed),
				installed
			}
		})
		.sort((a, b) => b.score - a.score || b.installs - a.installs)
		.slice(0, MAX_SUGGESTIONS)

	return { profile, suggestions, marketplaceError }
}
