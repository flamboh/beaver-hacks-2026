import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { basename, dirname, isAbsolute, resolve } from "node:path"
import type * as sqlite3 from "sqlite3"
import type {
	CreateWorkspaceInput,
	DeleteWorkspaceResult,
	ProjectRow,
	ProjectWorkspaceInput,
	UpdateWorkspaceInput,
	WorkspaceIdInput,
	WorkspaceRow
} from "./contracts"
import type { ProjectTableRow, WorkspaceTableRow } from "./rowMappers"
import { toProjectRow, toWorkspaceRow } from "./rowMappers"
import {
	assertDirectory,
	assertWorkspaceTemplate,
	canonicalPath,
	DEFAULT_WORKSPACE_TEMPLATE,
	expandHomePath,
	normalizeBranchName,
	resolveGitRoot,
	runGit,
	slugify
} from "./workspaceUtils"

function nowIso(): string {
	return new Date().toISOString()
}

function isUniqueWorkspacePathError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return error.message.includes("SQLITE_CONSTRAINT") && error.message.includes("workspaces.path")
}

export class WorkspaceService {
	constructor(private readonly db: sqlite3.Database) {}

	async list(input: ProjectWorkspaceInput): Promise<WorkspaceRow[]> {
		const rows = await this.all<WorkspaceTableRow>(
			`
				SELECT id, project_id, name, path, git_root, active, created_at, accessed, last_prompted_at
				FROM workspaces
				WHERE project_id = ?
				ORDER BY last_prompted_at DESC, created_at ASC
			`,
			[input.projectId]
		)
		return rows.map(toWorkspaceRow)
	}

	async get(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		const row = await this.getRow<WorkspaceTableRow>(
			`
				SELECT id, project_id, name, path, git_root, active, created_at, accessed, last_prompted_at
				FROM workspaces
				WHERE id = ?
			`,
			[input.id]
		)
		if (!row) throw new Error("Workspace not found.")
		return toWorkspaceRow(row)
	}

	async getActive(input: ProjectWorkspaceInput): Promise<WorkspaceRow> {
		const row = await this.getRow<WorkspaceTableRow>(
			`
				SELECT id, project_id, name, path, git_root, active, created_at, accessed, last_prompted_at
				FROM workspaces
				WHERE project_id = ? AND active = 1
			`,
			[input.projectId]
		)
		if (!row) {
			const [workspace] = await this.list(input)
			if (!workspace) throw new Error("Workspace not found.")
			return workspace
		}
		return toWorkspaceRow(row)
	}

	async create(input: CreateWorkspaceInput): Promise<WorkspaceRow> {
		const project = await this.getProject(input.projectId)
		const name = input.name.trim()
		if (!name) throw new Error("Workspace name is required.")

		const source = input.sourceWorkspaceId
			? await this.getSourceWorkspace(input.sourceWorkspaceId, project.id)
			: null
		const sourceGitRoot = await resolveGitRoot(source?.path ?? project.path)
		const customPath = input.path?.trim()
		const path = customPath
			? canonicalPath(customPath)
			: await this.nextDefaultWorkspacePath(project, name)

		if (customPath) {
			assertDirectory(path)
		} else if (sourceGitRoot) {
			await this.createGitWorktree(sourceGitRoot, path, input.branch?.trim() || name)
		} else {
			mkdirSync(path, { recursive: true })
		}

		assertDirectory(path)
		const gitRoot = await resolveGitRoot(path)
		const existing = await this.list({ projectId: input.projectId })
		const timestamp = nowIso()
		const workspace: WorkspaceRow = {
			id: `workspace:${randomUUID()}`,
			projectId: input.projectId,
			name,
			path,
			gitRoot,
			active: existing.length === 0,
			createdAt: timestamp,
			accessed: timestamp,
			lastPromptedAt: timestamp
		}

		try {
			await this.run(
				`
					INSERT INTO workspaces (id, project_id, name, path, git_root, active, created_at, accessed, last_prompted_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`,
				[
					workspace.id,
					workspace.projectId,
					workspace.name,
					workspace.path,
					workspace.gitRoot,
					workspace.active ? 1 : 0,
					workspace.createdAt,
					workspace.accessed,
					workspace.lastPromptedAt
				]
			)
		} catch (error) {
			if (isUniqueWorkspacePathError(error)) {
				throw new Error("A workspace with this path already exists.")
			}
			throw error
		}

		return workspace
	}

	async update(input: UpdateWorkspaceInput): Promise<WorkspaceRow> {
		const name = input.name.trim()
		if (!name) throw new Error("Workspace name is required.")
		const path = canonicalPath(input.path)
		assertDirectory(path)
		const gitRoot = await resolveGitRoot(path)
		await this.run(
			`
				UPDATE workspaces
				SET name = ?, path = ?, git_root = ?
				WHERE id = ?
			`,
			[name, path, gitRoot, input.id]
		)
		return this.get(input)
	}

	async touchPrompted(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		const timestamp = nowIso()
		await this.run(`UPDATE workspaces SET last_prompted_at = ? WHERE id = ?`, [timestamp, input.id])
		return this.get(input)
	}

	async activate(input: WorkspaceIdInput): Promise<WorkspaceRow> {
		const workspace = await this.get(input)
		const timestamp = nowIso()
		await this.run(`UPDATE workspaces SET active = 0 WHERE project_id = ?`, [workspace.projectId])
		await this.run(`UPDATE workspaces SET active = 1, accessed = ? WHERE id = ?`, [
			timestamp,
			input.id
		])
		return this.get(input)
	}

	async delete(input: WorkspaceIdInput): Promise<DeleteWorkspaceResult> {
		const workspace = await this.get(input)
		const workspaces = await this.list({ projectId: workspace.projectId })
		if (workspaces.length <= 1) throw new Error("Cannot delete the only workspace.")
		const nextWorkspace = workspaces.find((candidate) => candidate.id !== workspace.id)
		if (!nextWorkspace) throw new Error("Next workspace not found.")

		await this.removeLinkedGitWorktree(workspace.path)
		await this.run(`DELETE FROM workspaces WHERE id = ?`, [workspace.id])
		const activeWorkspace = await this.activate({ id: nextWorkspace.id })
		return { activeWorkspace, deletedWorkspaceId: workspace.id }
	}

	async backfill(projects: ProjectRow[]): Promise<void> {
		for (const project of projects) {
			const existing = await this.list({ projectId: project.id })
			if (existing.length > 0) continue
			await this.create({
				projectId: project.id,
				name: slugify(project.name || basename(project.path)),
				path: project.path
			})
		}
	}

	private async getProject(projectId: string): Promise<ProjectRow> {
		const row = await this.getRow<ProjectTableRow>(
			`
				SELECT id, name, path, enter_dev_action, created_at, accessed
				FROM projects
				WHERE id = ?
			`,
			[projectId]
		)
		if (!row) throw new Error("Project not found.")
		return toProjectRow(row)
	}

	private async getSourceWorkspace(workspaceId: string, projectId: string): Promise<WorkspaceRow> {
		const workspace = await this.get({ id: workspaceId })
		if (workspace.projectId !== projectId) throw new Error("Workspace source mismatch.")
		return workspace
	}

	private async nextDefaultWorkspacePath(
		project: ProjectRow,
		workspaceName: string
	): Promise<string> {
		const template =
			(await this.getSetting("workspace.default_template")) || DEFAULT_WORKSPACE_TEMPLATE
		assertWorkspaceTemplate(template)
		const workspaceSlug = slugify(workspaceName)
		const projectSlug = slugify(project.name || basename(project.path))
		const projectParent = dirname(project.path)
		const expanded = template
			.replaceAll("{projectSlug}", projectSlug)
			.replaceAll("{workspaceSlug}", workspaceSlug)
		const expandedPath = expandHomePath(expanded)
		const basePath = isAbsolute(expandedPath) ? expandedPath : resolve(projectParent, expandedPath)
		let candidate = basePath
		let suffix = 2
		while (existsSync(candidate)) {
			candidate = `${basePath}-${suffix}`
			suffix += 1
		}
		return candidate
	}

	private async createGitWorktree(
		sourceGitRoot: string,
		path: string,
		branchInput: string
	): Promise<void> {
		const branch = normalizeBranchName(branchInput)
		if (!branch) throw new Error("Branch name is required.")
		mkdirSync(dirname(path), { recursive: true })
		const exists = await this.branchExists(sourceGitRoot, branch)
		if (exists) throw new Error(`Branch already exists: ${branch}`)
		await runGit(sourceGitRoot, ["worktree", "add", "-b", branch, path, "HEAD"])
	}

	private async branchExists(cwd: string, branch: string): Promise<boolean> {
		try {
			await runGit(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`])
			return true
		} catch {
			return false
		}
	}

	private async removeLinkedGitWorktree(path: string): Promise<void> {
		if (!existsSync(path)) return
		const [gitDirRaw, commonDirRaw] = await Promise.all([
			runGit(path, ["rev-parse", "--git-dir"]).catch(() => ""),
			runGit(path, ["rev-parse", "--git-common-dir"]).catch(() => "")
		])
		const gitDir = resolve(path, gitDirRaw)
		const commonDir = resolve(path, commonDirRaw)
		if (!gitDirRaw || !commonDirRaw || gitDir === commonDir) return

		const status = await runGit(path, ["status", "--porcelain"])
		if (status) throw new Error("Commit or discard changes before deleting this worktree.")
		await runGit(path, ["worktree", "remove", "--force", path])
	}

	private async getSetting(key: string): Promise<string> {
		const row = await this.getRow<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?`, [
			key
		])
		return row?.value ?? ""
	}

	private async run(sql: string, params: unknown[]): Promise<void> {
		await new Promise<void>((resolveCommand, reject) => {
			this.db.run(sql, params, (error) => {
				if (error) {
					reject(error)
					return
				}
				resolveCommand()
			})
		})
	}

	private async getRow<T>(sql: string, params: unknown[]): Promise<T> {
		return new Promise<T>((resolveCommand, reject) => {
			this.db.get<T>(sql, params, (error, row) => {
				if (error) {
					reject(error)
					return
				}
				resolveCommand(row)
			})
		})
	}

	private async all<T>(sql: string, params: unknown[]): Promise<T[]> {
		return new Promise<T[]>((resolveCommand, reject) => {
			this.db.all<T>(sql, params, (error, rows) => {
				if (error) {
					reject(error)
					return
				}
				resolveCommand(rows)
			})
		})
	}
}
