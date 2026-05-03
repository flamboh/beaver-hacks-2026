import type { JSX } from "react"
import { useState } from "react"
import { GitBranch } from "lucide-react"
import { checkoutGitBranch, createGitBranch, useGitStatus } from "../agentStore"
import { GitCommitMenu } from "./GitCommitMenu"

interface GitLaneActionsProps {
	workspaceId: string
	workspaceName: string
}

function branchNameForFeature(feature: string): string {
	return feature
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._/-]+/g, "-")
		.replace(/^[-/]+|[-/]+$/g, "")
}

export function GitLaneActions({
	workspaceId,
	workspaceName
}: GitLaneActionsProps): JSX.Element | null {
	const status = useGitStatus(workspaceId)
	const [isBusy, setIsBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const branchName = branchNameForFeature(workspaceName)
	const currentBranch = status?.branch ?? null
	const isCurrentBranch = Boolean(branchName && status?.branch === branchName)
	const branchExists = Boolean(status?.branches.some((branch) => branch.name === branchName))

	function checkoutFeatureBranch(): void {
		if (!branchName || isBusy || isCurrentBranch) return
		setError(null)
		setIsBusy(true)
		const task = branchExists
			? checkoutGitBranch({ workspaceId, branch: branchName })
			: createGitBranch({ workspaceId, branch: branchName })
		void task
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	if (status && !status.isRepo) return null

	return (
		<div className="pointer-events-auto flex items-center gap-1.5">
			<GitCommitMenu workspaceId={workspaceId} featureBranchName={branchName} />
			<button
				type="button"
				onClick={checkoutFeatureBranch}
				disabled={isBusy || !branchName || isCurrentBranch}
				className="inline-flex h-8 max-w-48 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-zinc-300 transition-colors duration-150 hover:bg-white/[0.07] hover:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-600"
				title={isCurrentBranch ? `On ${branchName}` : `Checkout ${branchName}`}
			>
				<GitBranch className="size-3.5 shrink-0" />
				<span className="truncate">
					{isBusy ? "Checking out..." : currentBranch ? currentBranch : branchName}
				</span>
			</button>
			{error ? <span className="max-w-64 truncate text-xs text-red-400">{error}</span> : null}
		</div>
	)
}
