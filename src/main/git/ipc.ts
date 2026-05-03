import { ipcMain } from "electron"
import { AgentEngine } from "../agent/agentEngine"
import { DatabaseService } from "../db/database"
import { GitService, MINI_MODEL, TOUR_MODEL } from "./gitService"
import type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitDiffTour,
	GitCommitMessage,
	GitCreateBranchInput,
	GitPushInput,
	GitReviewFileInput,
	GitReviewFilesInput,
	GitRunStackedActionInput
} from "./contracts"

async function resolveWorkspaceCwd(
	database: DatabaseService,
	workspaceId: string
): Promise<{ cwd: string; workspaceId: string; workspacePath: string }> {
	const workspace = await database.getWorkspace({ id: workspaceId })
	return {
		cwd: workspace.gitRoot ?? workspace.path,
		workspaceId: workspace.id,
		workspacePath: workspace.path
	}
}

export function registerGitIpc(
	git: GitService,
	agentEngine: AgentEngine,
	database: DatabaseService
): void {
	ipcMain.handle("git:get-status", async (_event, workspaceId: string) => {
		const workspace = await resolveWorkspaceCwd(database, workspaceId)
		return git.status(workspace.cwd, workspace)
	})
	ipcMain.handle("git:get-working-tree-diff", async (_event, workspaceId: string) => {
		const workspace = await resolveWorkspaceCwd(database, workspaceId)
		return git.workingTreeDiff(workspace.cwd, workspace)
	})
	ipcMain.handle("git:checkout", async (_event, input: GitCheckoutInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const status = await git.checkout({ cwd: workspace.cwd, branch: input.branch })
		return { ...status, workspaceId: workspace.workspaceId, workspacePath: workspace.workspacePath }
	})
	ipcMain.handle("git:create-branch", async (_event, input: GitCreateBranchInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const status = await git.createBranch({ cwd: workspace.cwd, branch: input.branch })
		return { ...status, workspaceId: workspace.workspaceId, workspacePath: workspace.workspacePath }
	})
	ipcMain.handle("git:accept-file", async (_event, input: GitReviewFileInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const status = await git.acceptFile({ cwd: workspace.cwd, path: input.path })
		return { ...status, workspaceId: workspace.workspaceId, workspacePath: workspace.workspacePath }
	})
	ipcMain.handle("git:accept-files", async (_event, input: GitReviewFilesInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const status = await git.acceptFiles({ cwd: workspace.cwd, paths: input.paths })
		return { ...status, workspaceId: workspace.workspaceId, workspacePath: workspace.workspacePath }
	})
	ipcMain.handle("git:deny-file", async (_event, input: GitReviewFileInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const status = await git.denyFile({ cwd: workspace.cwd, path: input.path })
		return { ...status, workspaceId: workspace.workspaceId, workspacePath: workspace.workspacePath }
	})
	ipcMain.handle("git:deny-files", async (_event, input: GitReviewFilesInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const status = await git.denyFiles({ cwd: workspace.cwd, paths: input.paths })
		return { ...status, workspaceId: workspace.workspaceId, workspacePath: workspace.workspacePath }
	})
	ipcMain.handle("git:commit-all", async (_event, input: GitCommitAllInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const result = await git.commitAll({ ...input, cwd: workspace.cwd })
		return {
			...result,
			status: {
				...result.status,
				workspaceId: workspace.workspaceId,
				workspacePath: workspace.workspacePath
			}
		}
	})
	ipcMain.handle("git:push", async (_event, input: GitPushInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const result = await git.push({ cwd: workspace.cwd })
		return {
			...result,
			status: {
				...result.status,
				workspaceId: workspace.workspaceId,
				workspacePath: workspace.workspacePath
			}
		}
	})
	ipcMain.handle("git:run-stacked-action", async (_event, input: GitRunStackedActionInput) => {
		const workspace = await resolveWorkspaceCwd(database, input.workspaceId)
		const result = await git.runStackedAction({
			...input,
			cwd: workspace.cwd,
			onProgress: (progress) => {
				_event.sender.send("git:stacked-action-progress", {
					...progress,
					workspaceId: workspace.workspaceId
				})
			},
			createPrContent: async (cwd) => {
				const prompt = await git.buildPullRequestPrompt(cwd)
				const raw = await agentEngine.runOneShot({
					cwd,
					prompt,
					model: MINI_MODEL,
					runtimeMode: "approval-required",
					timeoutMs: 60_000
				})
				return git.parsePullRequestContent(raw)
			}
		})
		return {
			...result,
			status: {
				...result.status,
				workspaceId: workspace.workspaceId,
				workspacePath: workspace.workspacePath
			}
		}
	})
	ipcMain.handle(
		"git:generate-commit-message",
		async (_event, workspaceId: string): Promise<GitCommitMessage> => {
			const workspace = await resolveWorkspaceCwd(database, workspaceId)
			const prompt = await git.buildCommitPrompt(workspace.cwd)
			const raw = await agentEngine.runOneShot({
				cwd: workspace.cwd,
				prompt,
				model: MINI_MODEL,
				runtimeMode: "approval-required",
				timeoutMs: 45_000
			})
			return git.parseCommitMessage(raw)
		}
	)
	ipcMain.handle(
		"git:generate-diff-tour",
		async (_event, workspaceId: string): Promise<GitDiffTour> => {
			const workspace = await resolveWorkspaceCwd(database, workspaceId)
			const prompt = await git.buildDiffTourPrompt(workspace.cwd)
			const raw = await agentEngine.runOneShot({
				cwd: workspace.cwd,
				prompt,
				model: TOUR_MODEL,
				runtimeMode: "approval-required",
				timeoutMs: 120_000
			})
			return git.parseDiffTour(raw)
		}
	)
}

export type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitCommitResult,
	GitDiffTour,
	GitCommitMessage,
	GitCreateBranchInput,
	GitPushInput,
	GitReviewFileInput,
	GitReviewFilesInput,
	GitPushResult,
	GitRunStackedActionInput,
	GitRunStackedActionResult,
	GitStackedActionProgressEvent,
	GitStackedAction,
	GitStatusSnapshot,
	GitWorkingTreeDiffSnapshot
} from "./contracts"
