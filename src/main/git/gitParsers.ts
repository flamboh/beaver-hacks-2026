import type { GitBranch, GitFileChange } from "./contracts"

function parseBranchAb(line: string): { ahead: number; behind: number } {
	const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line.trim())
	return {
		ahead: Number(match?.[1] ?? "0"),
		behind: Number(match?.[2] ?? "0")
	}
}

function parseStatusPath(line: string): string | null {
	if (line.startsWith("? ") || line.startsWith("! ")) {
		const path = line.slice(2).trim()
		return path.length > 0 ? path : null
	}

	if (line.startsWith("1 ")) {
		const fields = line.trim().split(/\s+/g)
		const path = fields.slice(8).join(" ").trim()
		return path.length > 0 ? path : null
	}

	if (line.startsWith("u ")) {
		const fields = line.trim().split(/\s+/g)
		const path = fields.slice(10).join(" ").trim()
		return path.length > 0 ? path : null
	}

	if (line.startsWith("2 ")) {
		const fields = line.split("\t")[0]?.trim().split(/\s+/g) ?? []
		const path = fields.slice(9).join(" ").trim()
		return path.length > 0 ? path : null
	}

	const tabParts = line.split("\t")
	const fromTab = tabParts.at(-1)?.trim() ?? ""
	if (fromTab.length > 0 && tabParts.length > 1) return fromTab

	const spaceParts = line.trim().split(/\s+/g)
	const path = spaceParts.at(-1)?.trim() ?? ""
	return path.length > 0 ? path : null
}

function parseFileStatus(line: string): string {
	if (line.startsWith("? ")) return "untracked"
	if (line.startsWith("! ")) return "ignored"
	if (line.startsWith("u ")) return "conflict"
	if (line.startsWith("2 ")) return "renamed"
	if (line.startsWith("1 ")) return line.slice(2, 4).trim() || "modified"
	return "modified"
}

export function parseStatus(stdout: string): {
	branch: string | null
	upstream: string | null
	ahead: number
	behind: number
	files: GitFileChange[]
} {
	let branch: string | null = null
	let upstream: string | null = null
	let ahead = 0
	let behind = 0
	const files: GitFileChange[] = []

	for (const line of stdout.split(/\r?\n/g)) {
		if (line.startsWith("# branch.head ")) {
			const value = line.slice("# branch.head ".length).trim()
			branch = value === "(detached)" ? null : value
			continue
		}
		if (line.startsWith("# branch.upstream ")) {
			upstream = line.slice("# branch.upstream ".length).trim() || null
			continue
		}
		if (line.startsWith("# branch.ab ")) {
			const parsed = parseBranchAb(line)
			ahead = parsed.ahead
			behind = parsed.behind
			continue
		}
		if (line.length === 0 || line.startsWith("# ")) continue

		const path = parseStatusPath(line)
		if (path) files.push({ path, status: parseFileStatus(line) })
	}

	return { branch, upstream, ahead, behind, files }
}

export function parseBranches(stdout: string, currentBranch: string | null): GitBranch[] {
	return stdout
		.split(/\r?\n/g)
		.map((name) => name.trim())
		.filter(Boolean)
		.slice(0, 200)
		.map((name) => ({ name, current: name === currentBranch }))
}

export function parseNumstat(stdout: string): { insertions: number; deletions: number } {
	let insertions = 0
	let deletions = 0
	for (const line of stdout.split(/\r?\n/g)) {
		const [addedRaw, deletedRaw] = line.split("\t")
		const added = Number.parseInt(addedRaw ?? "0", 10)
		const deleted = Number.parseInt(deletedRaw ?? "0", 10)
		insertions += Number.isFinite(added) ? added : 0
		deletions += Number.isFinite(deleted) ? deleted : 0
	}
	return { insertions, deletions }
}
