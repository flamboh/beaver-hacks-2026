import { readdir, readFile, rm } from "node:fs/promises"
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

export interface InstalledSkill {
	name: string
	path: string
	description: string | null
}

const execFileAsync = promisify(execFile)
const PROJECT_SKILL_DIRS = [
	path.join(".agents", "skills"),
	path.join(".codex", "skills"),
	path.join(".claude", "skills"),
	"skills"
]

function normalize(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

async function readSkillMetadata(
	skillPath: string
): Promise<{ name: string | null; description: string | null } | null> {
	const contents = await readFile(path.join(skillPath, "SKILL.md"), "utf8").catch(() => null)
	if (!contents) return null
	const name = contents.match(/^name:\s*"?([^"\n]+)"?/m)?.[1]?.trim() ?? null
	const description = contents.match(/^description:\s*"?([^"\n]+)"?/m)?.[1]?.trim() ?? null
	return { name, description }
}

async function listRoot(root: string, depth = 0): Promise<InstalledSkill[]> {
	try {
		const entries = await readdir(root, { withFileTypes: true })
		const skills: InstalledSkill[] = []
		for (const entry of entries) {
			if (!entry.isDirectory()) continue

			const skillPath = path.join(root, entry.name)
			const metadata = await readSkillMetadata(skillPath)
			if (metadata) {
				skills.push({
					name: metadata.name ?? entry.name,
					path: skillPath,
					description: metadata.description
				})
				continue
			}

			if (depth < 1) skills.push(...(await listRoot(skillPath, depth + 1)))
		}
		return skills
	} catch {
		return []
	}
}

function skillRoots(cwd: string): string[] {
	return PROJECT_SKILL_DIRS.map((root) => path.join(cwd, root))
}

function isInsideRoot(root: string, value: string): boolean {
	const relative = path.relative(root, value)
	return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function parseSkillsList(output: string): string[] {
	return output
		.split("\n")
		.map((line) => line.match(/([^\s@]+\/[^\s@]+)@([^\s]+)/)?.slice(1, 3))
		.filter((match): match is string[] => Boolean(match))
		.flatMap(([source, slug]) => [normalize(slug), normalize(`${source}@${slug}`)])
}

async function listCliProjectSkillKeys(cwd: string): Promise<string[]> {
	try {
		const { stdout } = await execFileAsync("npx", ["skills", "list"], {
			cwd,
			timeout: 15_000
		})
		return parseSkillsList(stdout)
	} catch {
		return []
	}
}

export async function listInstalledSkills(cwd: string): Promise<InstalledSkill[]> {
	const roots = await Promise.all(skillRoots(cwd).map((root) => listRoot(root)))
	const byName = new Map<string, InstalledSkill>()
	for (const skill of roots.flat()) {
		byName.set(normalize(skill.name), skill)
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function removeInstalledSkill(cwd: string, skillPath: string): Promise<void> {
	const normalizedPath = path.resolve(skillPath)
	const root = skillRoots(cwd)
		.map((skillRoot) => path.resolve(skillRoot))
		.find((skillRoot) => isInsideRoot(skillRoot, normalizedPath))
	if (!root) throw new Error("Skill path is outside this project.")

	await rm(normalizedPath, { recursive: true, force: true })
}

export async function listInstalledSkillKeys(cwd: string): Promise<Set<string>> {
	const cliKeys = await listCliProjectSkillKeys(cwd)
	return new Set(
		(await listInstalledSkills(cwd))
			.flatMap((skill) => [normalize(skill.name), normalize(path.basename(skill.path))])
			.concat(cliKeys)
	)
}

export function matchesInstalledSkill(
	installedKeys: Set<string>,
	skill: { slug: string; name: string; installUrl?: string | null; id?: string }
): boolean {
	return (
		installedKeys.has(normalize(skill.slug)) ||
		installedKeys.has(normalize(skill.name)) ||
		Boolean(skill.installUrl && installedKeys.has(normalize(skill.installUrl))) ||
		Boolean(skill.id && installedKeys.has(normalize(skill.id.replace(/\//g, "@"))))
	)
}
