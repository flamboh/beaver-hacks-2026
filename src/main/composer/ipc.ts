import { execFile } from "node:child_process"
import { homedir } from "node:os"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { ipcMain } from "electron"
import { listInstalledSkills } from "../skills/installedSkills"

const execFileAsync = promisify(execFile)
const MAX_FILE_RESULTS = 24

export interface ComposerFileSuggestion {
	path: string
	name: string
}

export interface ComposerMentionSuggestion {
	name: string
	path: string
	description: string | null
	kind: "plugin" | "skill"
}

export interface ComposerSearchFilesInput {
	cwd: string
	query: string
}

function scorePath(filePath: string, query: string): number {
	const haystack = filePath.toLowerCase()
	const needle = query.toLowerCase()
	if (!needle) return 1
	if (haystack === needle) return 100
	if (path.basename(haystack) === needle) return 90
	if (haystack.startsWith(needle)) return 80
	if (path.basename(haystack).startsWith(needle)) return 70
	if (haystack.includes(needle)) return 50
	return 0
}

interface PluginManifest {
	name: string
	description?: string
	mcpServers?: string
	interface?: {
		displayName?: string
		shortDescription?: string
		longDescription?: string
	}
}

function codexHome(): string {
	return process.env.CODEX_HOME ?? path.join(homedir(), ".codex")
}

async function enabledPluginKeys(): Promise<Set<string>> {
	const config = await readFile(path.join(codexHome(), "config.toml"), "utf8").catch(() => "")
	const keys = new Set<string>()
	for (const match of config.matchAll(/^\[plugins\."([^"]+)"\]\s*\nenabled\s*=\s*true/gm)) {
		const key = match[1]
		if (key) keys.add(key)
	}
	return keys
}

async function pluginManifestPaths(root: string, depth = 0): Promise<string[]> {
	if (depth > 6) return []
	const manifest = path.join(root, ".codex-plugin", "plugin.json")
	if (
		await readFile(manifest, "utf8")
			.then(Boolean)
			.catch(() => false)
	)
		return [manifest]

	const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
	const nested = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => pluginManifestPaths(path.join(root, entry.name), depth + 1))
	)
	return nested.flat()
}

function pluginKeyFromManifestPath(manifestPath: string): string | null {
	const relative = path.relative(path.join(codexHome(), "plugins", "cache"), manifestPath)
	const parts = relative.split(path.sep)
	if (parts.length < 4) return null
	return `${parts[1]}@${parts[0]}`
}

async function listInstalledPluginMentions(): Promise<ComposerMentionSuggestion[]> {
	const enabledKeys = await enabledPluginKeys()
	const manifests = await pluginManifestPaths(path.join(codexHome(), "plugins", "cache"))
	const mentions: Array<ComposerMentionSuggestion | null> = await Promise.all(
		manifests.map(async (manifestPath) => {
			const pluginKey = pluginKeyFromManifestPath(manifestPath)
			if (!pluginKey || !enabledKeys.has(pluginKey)) return null

			const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PluginManifest
			const pluginName = pluginKey.split("@")[0] ?? manifest.name
			const hasMcp = Boolean(manifest.mcpServers)
			const description =
				manifest.interface?.shortDescription ??
				manifest.description ??
				(hasMcp ? "Plugin · MCP server" : "Plugin")

			return {
				name: pluginName,
				path: `plugin://${pluginKey}`,
				description: hasMcp ? `${description} · MCP` : description,
				kind: "plugin" as const
			}
		})
	)
	return mentions
		.filter((mention): mention is ComposerMentionSuggestion => Boolean(mention))
		.sort((a, b) => a.name.localeCompare(b.name))
}

async function listComposerMentions(cwd: string): Promise<ComposerMentionSuggestion[]> {
	const [plugins, skills] = await Promise.all([
		listInstalledPluginMentions(),
		listInstalledSkills(cwd)
	])
	const skillMentions = skills.map((skill) => ({
		name: skill.name,
		path: skill.path,
		description: skill.description,
		kind: "skill" as const
	}))
	return plugins.concat(skillMentions)
}

async function searchProjectFiles(
	input: ComposerSearchFilesInput
): Promise<ComposerFileSuggestion[]> {
	const query = input.query.trim()
	const { stdout } = await execFileAsync(
		"rg",
		[
			"--files",
			"--hidden",
			"--glob",
			"!.git",
			"--glob",
			"!node_modules",
			"--glob",
			"!dist",
			"--glob",
			"!out"
		],
		{ cwd: input.cwd, timeout: 10_000, maxBuffer: 4 * 1024 * 1024 }
	)

	return stdout
		.split("\n")
		.filter(Boolean)
		.map((filePath) => ({ filePath, score: scorePath(filePath, query) }))
		.filter((result) => result.score > 0)
		.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
		.slice(0, MAX_FILE_RESULTS)
		.map(({ filePath }) => ({
			path: filePath,
			name: path.basename(filePath)
		}))
}

export function registerComposerIpc(): void {
	ipcMain.handle("composer:search-files", (_event, input: ComposerSearchFilesInput) =>
		searchProjectFiles(input)
	)
	ipcMain.handle("composer:list-mentions", (_event, cwd: string) => listComposerMentions(cwd))
}
