import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type {
	GitCommitMessage,
	GitCommitResult,
	GitDiffTour,
	GitPullRequestContent,
	GitPushResult,
	GitRunStackedActionInput,
	GitRunStackedActionResult,
	GitStackedActionProgressEvent,
	GitStatusSnapshot,
	GitStackedAction,
	GitWorkingTreeDiffSnapshot
} from "./contracts"
import { DEFAULT_MAX_BUFFER, runGh, runGit, runGitAllowExit } from "./gitCommands"
import { parseBranches, parseNumstat, parseStatus } from "./gitParsers"

const COMMIT_CONTEXT_MAX_BUFFER = 256 * 1024
const MINI_MODEL = "gpt-5.4-mini"
const TOUR_MODEL = "gpt-5.5"

interface GitWorkspaceMeta {
	workspaceId?: string | null
	workspacePath?: string | null
}

interface GitCwdInput {
	cwd: string
}

interface GitCwdBranchInput extends GitCwdInput {
	branch: string
}

interface GitCwdCommitInput extends GitCwdInput {
	subject: string
	body?: string
}

interface GitRunStackedActionServiceInput extends GitCwdInput, GitRunStackedActionInput {
	onProgress?: (event: Omit<GitStackedActionProgressEvent, "workspaceId">) => void
	createPrContent?: (cwd: string) => Promise<GitPullRequestContent>
}

function nowIso(): string {
	return new Date().toISOString()
}

function normalizeBranchName(branch: string): string {
	return branch
		.trim()
		.replace(/[^A-Za-z0-9._/-]+/g, "-")
		.replace(/^[-/]+|[-/]+$/g, "")
}

function actionNeedsCommit(action: GitStackedAction): boolean {
	return action === "commit" || action === "commit_push" || action === "commit_push_pr"
}

function actionNeedsPush(action: GitStackedAction): boolean {
	return (
		action === "push" ||
		action === "create_pr" ||
		action === "commit_push" ||
		action === "commit_push_pr"
	)
}

function actionNeedsPr(action: GitStackedAction): boolean {
	return action === "create_pr" || action === "commit_push_pr"
}

async function buildUntrackedPatch(cwd: string): Promise<string> {
	const result = await runGit(cwd, ["ls-files", "--others", "--exclude-standard"])
	const patches = await Promise.all(
		result.stdout
			.split(/\r?\n/g)
			.map((path) => path.trim())
			.filter(Boolean)
			.map((path) =>
				runGitAllowExit(
					cwd,
					["diff", "--no-index", "--patch", "--no-color", "--", "/dev/null", path],
					["1"]
				).catch(() => ({ stdout: "", stderr: "" }))
			)
	)
	return patches
		.map((patch) => patch.stdout)
		.filter(Boolean)
		.join("\n")
}

export class GitService {
	async status(cwd: string, meta: GitWorkspaceMeta = {}): Promise<GitStatusSnapshot> {
		try {
			await runGit(cwd, ["rev-parse", "--is-inside-work-tree"])
		} catch {
			return {
				workspaceId: meta.workspaceId ?? null,
				workspacePath: meta.workspacePath ?? null,
				cwd,
				isRepo: false,
				branch: null,
				upstream: null,
				ahead: 0,
				behind: 0,
				hasRemote: false,
				openPullRequestUrl: null,
				files: [],
				insertions: 0,
				deletions: 0,
				branches: [],
				updatedAt: nowIso()
			}
		}

		const statusResult = await runGit(cwd, ["status", "--porcelain=v2", "--branch"])
		const parsed = parseStatus(statusResult.stdout)
		const [branchesResult, remotesResult, numstatResult, openPullRequestUrl] = await Promise.all([
			runGit(cwd, ["branch", "--format=%(refname:short)"]),
			runGit(cwd, ["remote"]),
			runGit(cwd, ["diff", "--numstat", "HEAD", "--"]).catch(() => ({ stdout: "", stderr: "" })),
			this.openPullRequestUrl(cwd, parsed.branch)
		])
		const stats = parseNumstat(numstatResult.stdout)

		return {
			workspaceId: meta.workspaceId ?? null,
			workspacePath: meta.workspacePath ?? null,
			cwd,
			isRepo: true,
			branch: parsed.branch,
			upstream: parsed.upstream,
			ahead: parsed.ahead,
			behind: parsed.behind,
			hasRemote: remotesResult.stdout.trim().length > 0,
			openPullRequestUrl,
			files: parsed.files,
			insertions: stats.insertions,
			deletions: stats.deletions,
			branches: parseBranches(branchesResult.stdout, parsed.branch),
			updatedAt: nowIso()
		}
	}

	private async openPullRequestUrl(cwd: string, branch: string | null): Promise<string | null> {
		if (!branch) return null
		try {
			const result = await runGh(cwd, [
				"pr",
				"list",
				"--head",
				branch,
				"--state",
				"open",
				"--limit",
				"1",
				"--json",
				"url",
				"--jq",
				".[0].url"
			])
			return result.stdout.trim() || null
		} catch {
			return null
		}
	}

	async checkout(input: GitCwdBranchInput): Promise<GitStatusSnapshot> {
		const branch = normalizeBranchName(input.branch)
		if (!branch) throw new Error("Branch required.")
		await runGit(input.cwd, ["checkout", branch])
		return this.status(input.cwd)
	}

	async createBranch(input: GitCwdBranchInput): Promise<GitStatusSnapshot> {
		const branch = normalizeBranchName(input.branch)
		if (!branch) throw new Error("Branch required.")
		await runGit(input.cwd, ["checkout", "-b", branch])
		return this.status(input.cwd)
	}

	async commitAll(input: GitCwdCommitInput): Promise<GitCommitResult> {
		const subject = input.subject.trim()
		const body = input.body?.trim() ?? ""
		if (!subject) throw new Error("Commit subject required.")

		await runGit(input.cwd, ["add", "-A", "--", "."])
		const args = ["commit", "-m", subject]
		if (body) args.push("-m", body)
		await runGit(input.cwd, args, DEFAULT_MAX_BUFFER)
		const commitSha = (await runGit(input.cwd, ["rev-parse", "--short=12", "HEAD"])).stdout.trim()
		return {
			commitSha,
			status: await this.status(input.cwd)
		}
	}

	async push(input: GitCwdInput): Promise<GitPushResult> {
		const snapshot = await this.status(input.cwd)
		if (!snapshot.branch) throw new Error("Cannot push detached HEAD.")
		const args = snapshot.upstream
			? ["push"]
			: ["push", "--set-upstream", "origin", snapshot.branch]
		await runGit(input.cwd, args, DEFAULT_MAX_BUFFER)
		return { status: await this.status(input.cwd) }
	}

	async createPullRequest(input: GitCwdInput & GitPullRequestContent): Promise<string | null> {
		const dir = await mkdtemp(path.join(tmpdir(), "beaver-pr-"))
		const bodyFile = path.join(dir, "body.md")
		try {
			await writeFile(bodyFile, input.body, "utf8")
			const result = await runGh(input.cwd, [
				"pr",
				"create",
				"--title",
				input.title,
				"--body-file",
				bodyFile
			])
			const url = result.stdout
				.split(/\r?\n/g)
				.map((line) => line.trim())
				.find((line) => /^https?:\/\//.test(line))
			return url ?? null
		} finally {
			await rm(dir, { recursive: true, force: true })
		}
	}

	async runStackedAction(
		input: GitRunStackedActionServiceInput
	): Promise<GitRunStackedActionResult> {
		let commitSha: string | null = null
		let prUrl: string | null = null
		let prContent: GitPullRequestContent | null = null
		const actionId = input.actionId ?? ""
		const progress = (
			phase: GitStackedActionProgressEvent["phase"],
			status: GitStackedActionProgressEvent["status"],
			command: string,
			message: string
		) => input.onProgress?.({ actionId, phase, status, command, message })

		if (actionNeedsPr(input.action)) {
			const snapshot = await this.status(input.cwd)
			if (snapshot.openPullRequestUrl) {
				throw new Error(`Open PR already exists: ${snapshot.openPullRequestUrl}`)
			}
		}

		if (actionNeedsCommit(input.action)) {
			progress("commit", "started", "git add -A && git commit", "Committing changes.")
			const commit = await this.commitAll({
				cwd: input.cwd,
				subject: input.subject ?? "",
				body: input.body
			})
			commitSha = commit.commitSha
			progress("commit", "finished", "git commit", `Created commit ${commitSha}.`)
		}

		if (actionNeedsPr(input.action)) {
			progress("pr", "started", "mini one-shot", "Generating PR title and description.")
			if (!input.createPrContent) throw new Error("PR content generator unavailable.")
			prContent = await input.createPrContent(input.cwd)
			progress("pr", "finished", "mini one-shot", "PR content generated.")
		}

		if (actionNeedsPush(input.action)) {
			progress("push", "started", "git push", "Pushing branch.")
			await this.push({ cwd: input.cwd })
			progress("push", "finished", "git push", "Push finished.")
		}

		if (actionNeedsPr(input.action)) {
			progress("pr", "started", "gh pr create", "Creating pull request.")
			if (!prContent) throw new Error("PR content unavailable.")
			prUrl = await this.createPullRequest({ cwd: input.cwd, ...prContent })
			progress("pr", "finished", "gh pr create", prUrl ? `Created ${prUrl}.` : "PR created.")
		}

		return {
			action: input.action,
			commitSha,
			prUrl,
			status: await this.status(input.cwd)
		}
	}

	async workingTreeDiff(
		cwd = process.cwd(),
		meta: GitWorkspaceMeta = {}
	): Promise<GitWorkingTreeDiffSnapshot> {
		try {
			await runGit(cwd, ["rev-parse", "--is-inside-work-tree"])
		} catch {
			return {
				workspaceId: meta.workspaceId ?? null,
				workspacePath: meta.workspacePath ?? null,
				cwd,
				isRepo: false,
				patch: "",
				updatedAt: nowIso()
			}
		}

		const [trackedPatch, untrackedPatch] = await Promise.all([
			runGit(cwd, ["diff", "--patch", "--minimal", "--no-color", "HEAD", "--"]),
			buildUntrackedPatch(cwd)
		])
		return {
			workspaceId: meta.workspaceId ?? null,
			workspacePath: meta.workspacePath ?? null,
			cwd,
			isRepo: true,
			patch: [trackedPatch.stdout, untrackedPatch].filter(Boolean).join("\n"),
			updatedAt: nowIso()
		}
	}

	async buildCommitPrompt(cwd: string): Promise<string> {
		const [status, stat, patch] = await Promise.all([
			this.status(cwd),
			runGit(cwd, ["diff", "--stat", "HEAD", "--"], COMMIT_CONTEXT_MAX_BUFFER).catch(() => ({
				stdout: "",
				stderr: ""
			})),
			runGit(
				cwd,
				["diff", "--patch", "--minimal", "--no-color", "HEAD", "--"],
				COMMIT_CONTEXT_MAX_BUFFER
			).catch(() => ({ stdout: "", stderr: "" }))
		])

		const changedFiles = status.files.map((file) => `${file.status}\t${file.path}`).join("\n")
		return [
			"Write a Conventional Commit message for these git changes.",
			'Return only JSON: {"subject":"type(scope): summary","body":"optional body"}.',
			"Use present tense. Keep subject under 72 chars. No markdown.",
			"",
			`Branch: ${status.branch ?? "detached"}`,
			`Files:\n${changedFiles || "(none)"}`,
			`Stat:\n${stat.stdout.trim() || "(none)"}`,
			`Patch:\n${patch.stdout.slice(0, 24_000).trim() || "(not available)"}`
		].join("\n")
	}

	async buildDiffTourPrompt(cwd: string): Promise<string> {
		const [status, stat, diff] = await Promise.all([
			this.status(cwd),
			runGit(cwd, ["diff", "--stat", "HEAD", "--"], COMMIT_CONTEXT_MAX_BUFFER).catch(() => ({
				stdout: "",
				stderr: ""
			})),
			this.workingTreeDiff(cwd)
		])
		const changedFiles = status.files.map((file) => `${file.status}\t${file.path}`).join("\n")
		return [
			"Create a comprehensive high-level tour of these working tree changes.",
			"Audience: a maintainer reviewing the branch before merge.",
			"Cover important implementation details, changed behavior, code-base impact, risk areas, and likely follow-up checks.",
			"Do not write a line-by-line review. Do not invent details absent from the diff.",
			"Use concise markdown with these sections: Overview, Important Changes, Codebase Impact, Review Focus.",
			"",
			`Branch: ${status.branch ?? "detached"}`,
			`Files:\n${changedFiles || "(none)"}`,
			`Stat:\n${stat.stdout.trim() || "(none)"}`,
			`Patch:\n${diff.patch.slice(0, 60_000).trim() || "(none)"}`
		].join("\n")
	}

	async buildPullRequestPrompt(cwd: string): Promise<string> {
		const status = await this.status(cwd)
		const originHead = await runGit(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"])
			.then((result) => result.stdout.trim())
			.catch(() => "")
		const base = originHead || status.upstream || "HEAD~10"
		const [commits, stat, patch] = await Promise.all([
			runGit(cwd, ["log", "--oneline", `${base}..HEAD`], COMMIT_CONTEXT_MAX_BUFFER).catch(() => ({
				stdout: "",
				stderr: ""
			})),
			runGit(cwd, ["diff", "--stat", base, "HEAD", "--"], COMMIT_CONTEXT_MAX_BUFFER).catch(() => ({
				stdout: "",
				stderr: ""
			})),
			runGit(
				cwd,
				["diff", "--patch", "--minimal", "--no-color", base, "HEAD", "--"],
				COMMIT_CONTEXT_MAX_BUFFER
			).catch(() => ({ stdout: "", stderr: "" }))
		])
		return [
			"Write GitHub pull request content for these branch changes.",
			'Return only JSON: {"title":"concise PR title","body":"markdown PR description"}.',
			"Title should be under 72 chars. Body should be useful to a maintainer.",
			"Body must include a short summary and validation/testing notes when inferable.",
			"Do not invent tests or implementation details absent from context.",
			"",
			`Branch: ${status.branch ?? "detached"}`,
			`Base: ${base}`,
			`Commits:\n${commits.stdout.trim() || "(none)"}`,
			`Stat:\n${stat.stdout.trim() || "(none)"}`,
			`Patch:\n${patch.stdout.slice(0, 60_000).trim() || "(not available)"}`
		].join("\n")
	}

	parseDiffTour(raw: string): GitDiffTour {
		return {
			tour: raw.trim(),
			updatedAt: nowIso()
		}
	}

	parseCommitMessage(raw: string): GitCommitMessage {
		const match = /\{[\s\S]*\}/.exec(raw.trim())
		if (!match) throw new Error("Mini model did not return JSON.")
		const parsed = JSON.parse(match[0]) as GitCommitMessage
		return {
			subject: parsed.subject.trim(),
			body: parsed.body?.trim() ?? ""
		}
	}

	parsePullRequestContent(raw: string): GitPullRequestContent {
		const match = /\{[\s\S]*\}/.exec(raw.trim())
		if (!match) throw new Error("Mini model did not return JSON.")
		const parsed = JSON.parse(match[0]) as GitPullRequestContent
		return {
			title: parsed.title.trim(),
			body: parsed.body.trim()
		}
	}
}

export { MINI_MODEL, TOUR_MODEL }
