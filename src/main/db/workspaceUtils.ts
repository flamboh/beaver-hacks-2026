import { execFile } from "node:child_process"
import { existsSync, realpathSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"

export const DEFAULT_WORKSPACE_TEMPLATE = "~/.nulloth/worktrees/{projectSlug}/{workspaceSlug}"

export function slugify(value: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
	return slug || "workspace"
}

export function normalizeBranchName(value: string): string {
	return value
		.trim()
		.replace(/[^A-Za-z0-9._/-]+/g, "-")
		.replace(/^[-/]+|[-/]+$/g, "")
}

export function assertWorkspaceTemplate(template: string): void {
	const trimmed = template.trim()
	if (!trimmed) throw new Error("Workspace template is required.")
	if (!trimmed.includes("{workspaceSlug}")) {
		throw new Error("Workspace template must include {workspaceSlug}.")
	}
}

export function canonicalPath(path: string): string {
	const resolved = resolve(expandHomePath(path.trim()))
	return existsSync(resolved) ? realpathSync(resolved) : resolved
}

export function expandHomePath(path: string): string {
	if (path === "~") return homedir()
	if (path.startsWith("~/")) return resolve(homedir(), path.slice(2))
	return path
}

export function assertDirectory(path: string): void {
	if (!existsSync(path)) throw new Error("Path does not exist.")
	if (!statSync(path).isDirectory()) throw new Error("Path must be a directory.")
}

export function runGit(cwd: string, args: readonly string[]): Promise<string> {
	return new Promise((resolveCommand, reject) => {
		execFile("git", [...args], { cwd, timeout: 10_000 }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error((stderr || error.message).trim()))
				return
			}
			resolveCommand(stdout.trim())
		})
	})
}

export async function resolveGitRoot(path: string): Promise<string | null> {
	try {
		return await runGit(path, ["rev-parse", "--show-toplevel"])
	} catch {
		return null
	}
}
