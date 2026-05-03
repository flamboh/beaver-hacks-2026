import type { JSX } from "react"
import { useState } from "react"
import { GitBranch } from "lucide-react"
import { checkoutGitBranch, useGitStatus } from "../agentStore"
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

	function checkoutBranch(nextBranch: string): void {
		if (!nextBranch || isBusy || nextBranch === status?.branch) return
		setError(null)
		setIsBusy(true)
		void checkoutGitBranch({ workspaceId, branch: nextBranch })
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	if (status && !status.isRepo) return null

	return (
		<div className="pointer-events-auto flex items-center gap-1.5">
			<label className="polished-button inline-flex h-8 max-w-48 items-center gap-1.5 px-1 text-xs text-zinc-500 hover:text-zinc-200">
				<GitBranch className="size-3.5 shrink-0" />
				<select
					value={status?.branch ?? ""}
					onChange={(event) => checkoutBranch(event.currentTarget.value)}
					disabled={isBusy || !status}
					className="min-w-0 cursor-pointer bg-transparent text-xs text-zinc-500 outline-none hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
					aria-label="Checkout branch"
				>
					{status?.branch ? null : <option value="">detached</option>}
					{status?.branches.map((branch) => (
						<option key={branch.name} value={branch.name}>
							{branch.name}
						</option>
					))}
				</select>
			</label>
			<GitCommitMenu workspaceId={workspaceId} featureBranchName={branchName} />
			{error ? <span className="max-w-64 truncate text-xs text-red-400">{error}</span> : null}
		</div>
	)
}
