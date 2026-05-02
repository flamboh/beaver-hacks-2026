import { execFile } from "node:child_process"
import { promisify } from "node:util"

export interface MarketplaceSkill {
	id: string
	slug: string
	name: string
	source: string
	installs: number
	sourceType: "github"
	installUrl: string
	url: string
	description: string
}

export interface MarketplaceSearchResult {
	skills: MarketplaceSkill[]
	error: string | null
}

const execFileAsync = promisify(execFile)
const SEARCH_TIMEOUT_MS = 20_000
const ESCAPE_CHAR = String.fromCharCode(27)

function stripAnsi(value: string): string {
	return value.replace(new RegExp(`${ESCAPE_CHAR}\\[[0-9;]*m`, "g"), "")
}

function parseInstalls(value: string): number {
	const normalized = value.trim().toLowerCase()
	const multiplier = normalized.endsWith("k") ? 1_000 : 1
	return Math.round(Number.parseFloat(normalized.replace(/k$/, "")) * multiplier)
}

function skillNameFromSlug(slug: string): string {
	return slug
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")
}

function parseSkillsOutput(output: string): MarketplaceSkill[] {
	const clean = stripAnsi(output)
	const lines = clean.split("\n")
	const skills: MarketplaceSkill[] = []

	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(/^([^\s@]+\/[^\s@]+)@([^\s]+)\s+([\d.]+K?) installs$/i)
		if (!match) continue

		const source = match[1]
		const slug = match[2]
		const url = lines[index + 1]?.match(/└\s+(https:\/\/skills\.sh\/\S+)/)?.[1] ?? ""
		skills.push({
			id: `${source}/${slug}`,
			slug,
			name: skillNameFromSlug(slug),
			source,
			installs: parseInstalls(match[3]),
			sourceType: "github",
			installUrl: `${source}@${slug}`,
			url,
			description: ""
		})
	}

	return skills
}

export async function searchMarketplaceSkills(query: string): Promise<MarketplaceSearchResult> {
	if (query.trim().length < 2) return { skills: [], error: null }

	try {
		const { stdout } = await execFileAsync("npx", ["skills", "find", query], {
			timeout: SEARCH_TIMEOUT_MS
		})
		return {
			skills: parseSkillsOutput(stdout),
			error: null
		}
	} catch (error) {
		return {
			skills: [],
			error: error instanceof Error ? error.message : String(error)
		}
	}
}
