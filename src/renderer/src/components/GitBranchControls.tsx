import type { JSX } from "react"
import { useState } from "react"
import { GitBranch } from "lucide-react"
import { checkoutGitBranch, createGitBranch, useGitStatus } from "../agentStore"

interface GitBranchControlsProps {
	cwd: string | null
}

function formatChanges(files: number, insertions: number, deletions: number): string {
	if (files === 0) return "clean"
	return `${files} files  +${insertions} -${deletions}`
}

export function GitBranchControls({ cwd }: GitBranchControlsProps): JSX.Element | null {
	const status = useGitStatus(cwd ?? "")
	const [branchDraft, setBranchDraft] = useState("")
	const [isBusy, setIsBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	function run(task: () => Promise<void>): void {
		if (!cwd || isBusy) return
		setError(null)
		setIsBusy(true)
		void task()
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	if (!cwd) return null

	return (
		<section className="mx-auto mt-3 flex max-w-3xl flex-col gap-2 border-t border-white/10 pt-3">
			<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
				<GitBranch className="size-3.5 text-zinc-500" aria-hidden="true" />
				<span className="max-w-48 truncate text-zinc-200">{status?.branch ?? "no branch"}</span>
				<span className="text-zinc-600">/</span>
				<span>
					{formatChanges(
						status?.files.length ?? 0,
						status?.insertions ?? 0,
						status?.deletions ?? 0
					)}
				</span>
				{status?.ahead || status?.behind ? (
					<span>
						ahead {status.ahead} behind {status.behind}
					</span>
				) : null}
			</div>

			{status && !status.isRepo ? (
				<p className="text-xs text-zinc-500">No git repository at this thread cwd.</p>
			) : null}

			{status?.isRepo ? (
				<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
					<select
						value={status.branch ?? ""}
						onChange={(event) =>
							run(() => checkoutGitBranch({ cwd, branch: event.currentTarget.value }))
						}
						className="h-8 rounded-md border border-white/10 bg-[#0f0f12] px-2 text-xs text-zinc-200 outline-none focus:border-white/20"
						disabled={isBusy}
						aria-label="Checkout branch"
					>
						{status.branches.map((branch) => (
							<option key={branch.name} value={branch.name}>
								{branch.name}
							</option>
						))}
					</select>
					<div className="flex gap-2">
						<input
							value={branchDraft}
							onChange={(event) => setBranchDraft(event.currentTarget.value)}
							placeholder="new branch"
							className="h-8 w-32 rounded-md border border-white/10 bg-[#0f0f12] px-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/20"
						/>
						<button
							type="button"
							disabled={isBusy || !branchDraft.trim()}
							onClick={() =>
								run(async () => {
									await createGitBranch({ cwd, branch: branchDraft })
									setBranchDraft("")
								})
							}
							className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-zinc-600"
						>
							New
						</button>
					</div>
				</div>
			) : null}

			{isBusy ? <p className="text-xs text-zinc-500">checkout...</p> : null}
			{error ? <p className="text-xs text-red-400">{error}</p> : null}
		</section>
	)
}
