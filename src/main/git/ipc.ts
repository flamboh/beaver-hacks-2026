import { ipcMain } from "electron"
import { AgentEngine } from "../agent/agentEngine"
import { GitService, MINI_MODEL, TOUR_MODEL } from "./gitService"
import type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitDiffTour,
	GitCommitMessage,
	GitCreateBranchInput,
	GitPushInput
} from "./contracts"

export function registerGitIpc(git: GitService, agentEngine: AgentEngine): void {
	ipcMain.handle("git:get-status", (_event, cwd: string) => git.status(cwd))
	ipcMain.handle("git:get-working-tree-diff", (_event, cwd?: string) => git.workingTreeDiff(cwd))
	ipcMain.handle("git:checkout", (_event, input: GitCheckoutInput) => git.checkout(input))
	ipcMain.handle("git:create-branch", (_event, input: GitCreateBranchInput) =>
		git.createBranch(input)
	)
	ipcMain.handle("git:commit-all", (_event, input: GitCommitAllInput) => git.commitAll(input))
	ipcMain.handle("git:push", (_event, input: GitPushInput) => git.push(input))
	ipcMain.handle(
		"git:generate-commit-message",
		async (_event, cwd: string): Promise<GitCommitMessage> => {
			const prompt = await git.buildCommitPrompt(cwd)
			const raw = await agentEngine.runOneShot({
				cwd,
				prompt,
				model: MINI_MODEL,
				runtimeMode: "approval-required",
				timeoutMs: 45_000
			})
			return git.parseCommitMessage(raw)
		}
	)
	ipcMain.handle("git:generate-diff-tour", async (_event, cwd: string): Promise<GitDiffTour> => {
		const prompt = await git.buildDiffTourPrompt(cwd)
		const raw = await agentEngine.runOneShot({
			cwd,
			prompt,
			model: TOUR_MODEL,
			runtimeMode: "approval-required",
			timeoutMs: 120_000
		})
		return git.parseDiffTour(raw)
	})
}

export type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitCommitResult,
	GitDiffTour,
	GitCommitMessage,
	GitCreateBranchInput,
	GitPushInput,
	GitPushResult,
	GitStatusSnapshot,
	GitWorkingTreeDiffSnapshot
} from "./contracts"
