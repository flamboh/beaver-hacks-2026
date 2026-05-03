import type { ProjectFileSummary } from "./projectFiles"

export interface ProjectSkillProfile {
	summary: string
	domains: string[]
	tasks: string[]
	searchQueries: string[]
	source: "codex" | "heuristic"
}

const DEFAULT_PROFILE_MODEL = "gpt-5-mini"

function parsePackageJson(files: ProjectFileSummary[]): string[] {
	const packageFile = files.find((file) => file.path.toLowerCase() === "package.json")
	if (!packageFile) return []

	const parsed = JSON.parse(packageFile.contents) as {
		dependencies?: Record<string, string>
		devDependencies?: Record<string, string>
	}
	return Object.keys({
		...parsed.dependencies,
		...parsed.devDependencies
	})
}

function inferDomains(files: ProjectFileSummary[]): string[] {
	const domains = new Set<string>()
	const deps = parsePackageJson(files)
	const text = files.map((file) => file.contents.toLowerCase()).join("\n")

	for (const dep of deps) {
		if (dep.includes("electron")) domains.add("electron")
		if (dep.includes("react")) domains.add("react")
		if (dep.includes("tanstack")) domains.add("tanstack")
		if (dep.includes("typescript")) domains.add("typescript")
		if (dep.includes("vite")) domains.add("vite")
		if (dep.includes("tailwind")) domains.add("tailwind")
	}

	if (text.includes("agent")) domains.add("agent infrastructure")
	if (text.includes("github") || text.includes("pull request")) domains.add("github")
	if (text.includes("ui") || text.includes("design")) domains.add("ui design")
	if (text.includes("test") || text.includes("lint")) domains.add("testing")

	return Array.from(domains)
}

function profileFromHeuristics(files: ProjectFileSummary[], prompt: string): ProjectSkillProfile {
	const domains = inferDomains(files)
	const tasks = [prompt, "project setup", "code quality"].filter((value) => value.trim().length > 0)
	const searchQueries = [
		[...domains.slice(0, 4), "best practices"].join(" "),
		[...domains.slice(0, 3), "agent skills"].join(" "),
		prompt.trim()
	].filter((query) => query.length >= 2)

	return {
		summary:
			domains.length > 0 ? `Project uses ${domains.join(", ")}.` : "Project profile inferred.",
		domains,
		tasks,
		searchQueries,
		source: "heuristic"
	}
}

function cleanStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.map((item) => String(item).trim())
		.filter(Boolean)
		.slice(0, 8)
}

function extractJson(text: string): string {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
	if (fenced?.[1]) return fenced[1].trim()

	const start = text.indexOf("{")
	const end = text.lastIndexOf("}")
	if (start >= 0 && end > start) return text.slice(start, end + 1)

	return text
}

function parseModelProfile(text: string): ProjectSkillProfile | null {
	const parsed = JSON.parse(extractJson(text)) as {
		summary?: unknown
		domains?: unknown
		tasks?: unknown
		searchQueries?: unknown
	}
	const searchQueries = cleanStringArray(parsed.searchQueries)
	if (searchQueries.length === 0) return null

	return {
		summary: String(parsed.summary ?? "Project profile.").slice(0, 240),
		domains: cleanStringArray(parsed.domains),
		tasks: cleanStringArray(parsed.tasks),
		searchQueries,
		source: "codex"
	}
}

export async function buildProjectSkillProfile(
	files: ProjectFileSummary[],
	prompt: string,
	runCodexPrompt?: (input: { prompt: string; model: string }) => Promise<string>
): Promise<ProjectSkillProfile> {
	const fallbackProfile = profileFromHeuristics(files, prompt)
	if (!runCodexPrompt) return fallbackProfile

	try {
		const modelOutput = await runCodexPrompt({
			model: process.env.SKILL_PROFILE_MODEL ?? DEFAULT_PROFILE_MODEL,
			prompt: [
				"Read these project files and suggest skills.sh CLI search queries.",
				"Return only JSON with keys: summary, domains, tasks, searchQueries.",
				"Use 6-8 specific multi-word searchQueries. No markdown.",
				JSON.stringify({ prompt, files })
			].join("\n\n")
		})

		return parseModelProfile(modelOutput) ?? fallbackProfile
	} catch {
		return fallbackProfile
	}
}
