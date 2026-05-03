import { buildProjectSkillProfile, type ProjectSkillProfile } from "../skills/projectProfile"
import { readProjectFiles } from "../skills/projectFiles"
import type { AgentMcpSuggestion } from "../agent/contracts"

export interface McpRecommendation {
	profile: ProjectSkillProfile
	suggestions: AgentMcpSuggestion[]
	searchError: string | null
}

export interface McpRecommenderOptions {
	runCodexPrompt?: (input: { prompt: string; model: string }) => Promise<string>
}

interface GithubRepo {
	full_name: string
	html_url: string
	description: string | null
	stargazers_count: number
	language: string | null
	topics?: string[]
}

interface GithubSearchResponse {
	items?: GithubRepo[]
}

const MCP_RANK_MODEL = "gpt-5.4-mini"
const MAX_QUERIES = 4
const MAX_CANDIDATES = 30
const MAX_SUGGESTIONS = 10
const SEARCH_TIMEOUT_MS = 12_000

function mcpQueries(profile: ProjectSkillProfile, prompt: string): string[] {
	const domains = profile.domains.slice(0, 4)
	return Array.from(
		new Set([
			...profile.searchQueries.map((query) => `${query} mcp server`),
			`${domains.join(" ")} model context protocol server`,
			`${prompt} mcp server`
		])
	)
		.map((query) => query.trim())
		.filter((query) => query.length >= 2)
		.slice(0, MAX_QUERIES)
}

function repoToSuggestion(repo: GithubRepo, score: number, reason = ""): AgentMcpSuggestion {
	const [owner = "", name = repo.full_name] = repo.full_name.split("/")
	return {
		id: repo.full_name,
		name,
		owner,
		repo: name,
		url: repo.html_url,
		description: repo.description ?? "",
		stars: repo.stargazers_count,
		language: repo.language,
		topics: repo.topics ?? [],
		installHint: `Review ${repo.full_name} README for MCP server setup.`,
		reason,
		score
	}
}

function fallbackScore(repo: GithubRepo, profile: ProjectSkillProfile): number {
	const haystack =
		`${repo.full_name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`.toLowerCase()
	const domainMatches = profile.domains.filter((domain) =>
		haystack.includes(domain.toLowerCase().split(" ")[0])
	).length
	const mcpBoost = haystack.includes("mcp") || haystack.includes("model context protocol") ? 40 : 0
	return Math.round(Math.log10(repo.stargazers_count + 1) * 10 + domainMatches * 12 + mcpBoost)
}

function extractJson(text: string): string {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
	if (fenced?.[1]) return fenced[1].trim()
	const start = text.indexOf("[")
	const end = text.lastIndexOf("]")
	if (start >= 0 && end > start) return text.slice(start, end + 1)
	return text
}

async function searchGithubMcpRepos(query: string): Promise<GithubRepo[]> {
	const url = new URL("https://api.github.com/search/repositories")
	url.searchParams.set("q", `${query} in:name,description,readme`)
	url.searchParams.set("sort", "stars")
	url.searchParams.set("order", "desc")
	url.searchParams.set("per_page", "10")

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "beaver-hacks-2026"
			},
			signal: controller.signal
		})
		if (!response.ok) throw new Error(`GitHub search failed: ${response.status}`)
		const data = (await response.json()) as GithubSearchResponse
		return data.items ?? []
	} finally {
		clearTimeout(timeout)
	}
}

async function rankWithModel(
	candidates: AgentMcpSuggestion[],
	profile: ProjectSkillProfile,
	options: McpRecommenderOptions
): Promise<AgentMcpSuggestion[] | null> {
	if (!options.runCodexPrompt || candidates.length === 0) return null

	const output = await options.runCodexPrompt({
		model: process.env.MCP_RANK_MODEL ?? MCP_RANK_MODEL,
		prompt: [
			"Pick the 10 best MCP servers for this project.",
			"Return only JSON array entries with keys: id, reason, installHint, score.",
			"Prefer MCP servers that are relevant, maintained, specific, and practical for local coding agents.",
			JSON.stringify({ profile, candidates })
		].join("\n\n")
	})
	const ranked = JSON.parse(extractJson(output)) as Array<{
		id: string
		reason?: string
		installHint?: string
		score?: number
	}>
	const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
	return ranked
		.flatMap((item) => {
			const candidate = byId.get(item.id)
			if (!candidate) return []
			return [
				{
					...candidate,
					reason: String(item.reason ?? candidate.reason).slice(0, 240),
					installHint: String(item.installHint ?? candidate.installHint).slice(0, 240),
					score: Number(item.score ?? candidate.score)
				}
			]
		})
		.slice(0, MAX_SUGGESTIONS)
}

export async function recommendProjectMcps(
	cwd: string,
	prompt: string,
	options: McpRecommenderOptions = {}
): Promise<McpRecommendation> {
	const files = await readProjectFiles(cwd)
	const profile = await buildProjectSkillProfile(files, prompt, options.runCodexPrompt)
	const queries = mcpQueries(profile, prompt)
	let searchError: string | null = null
	const results = await Promise.all(
		queries.map((query) =>
			searchGithubMcpRepos(query).catch((error) => {
				searchError = error instanceof Error ? error.message : String(error)
				return []
			})
		)
	)
	const byId = new Map<string, GithubRepo>()
	for (const repo of results.flat()) {
		byId.set(repo.full_name, repo)
	}
	const candidates = Array.from(byId.values())
		.map((repo) => repoToSuggestion(repo, fallbackScore(repo, profile)))
		.sort((a, b) => b.score - a.score || b.stars - a.stars)
		.slice(0, MAX_CANDIDATES)

	const ranked = await rankWithModel(candidates, profile, options).catch(() => null)
	return {
		profile,
		suggestions: ranked ?? candidates.slice(0, MAX_SUGGESTIONS),
		searchError
	}
}
