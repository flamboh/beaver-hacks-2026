import { useState } from "react"
import { AlertTriangle, GitBranch, PanelLeft, Tally1 } from "lucide-react"
import { checkoutGitBranch, createGitBranch, useGitStatus } from "@renderer/agentStore"
import { GitCommitMenu } from "../GitCommitMenu"
import type { WorkspaceRow } from "../../../../main/db/ipc"

interface Props {
	activeAgentCount: number
	activeWorkspace: WorkspaceRow | null
	onToggleSidebar: () => void
	onWorkspaceChange: (workspaceId: string) => void
	workspaces: WorkspaceRow[]
}

export default function TopBar({
	activeAgentCount,
	activeWorkspace,
	onToggleSidebar,
	onWorkspaceChange,
	workspaces
}: Props) {
	const workspaceId = activeWorkspace?.id ?? null
	const status = useGitStatus(workspaceId ?? "")
	const [branchDraft, setBranchDraft] = useState("")
	const [isBusy, setIsBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	function run(task: () => Promise<void>): void {
		if (!workspaceId || isBusy) return
		setError(null)
		setIsBusy(true)
		void task()
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	return (
		<div className="flex h-11 w-full shrink-0 items-center justify-between border-b border-white/5 bg-neutral-900 px-3">
			<div className="flex items-center gap-2">
				<button
					onClick={onToggleSidebar}
					className="rounded-md p-1.5 text-neutral-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
					title="Toggle sidebar"
				>
					<PanelLeft size={15} />
				</button>
				<div className="ml-1 flex items-center gap-2 text-sm font-medium">
					<span className="tracking-wide text-white">NULLOTH</span>
					<Tally1 size={14} className="text-neutral-600" />
					<span className="text-neutral-400">Workbench</span>
				</div>
			</div>
			<div className="flex min-w-0 items-center gap-2">
				{activeAgentCount > 0 ? (
					<span
						className="flex size-7 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/10 text-amber-300"
						title="Agents active in workspace"
					>
						<AlertTriangle size={14} />
					</span>
				) : null}
				<select
					value={workspaceId ?? ""}
					onChange={(event) => onWorkspaceChange(event.currentTarget.value)}
					className="h-7 max-w-48 rounded-md border border-white/10 bg-[#0f0f12] px-2 text-xs text-zinc-200 outline-none focus:border-white/20"
					aria-label="Workspace"
				>
					{workspaces.map((workspace) => (
						<option key={workspace.id} value={workspace.id}>
							{workspace.name}
						</option>
					))}
				</select>
				<div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1">
					<GitBranch size={14} className="text-neutral-500" />
					<select
						value={status?.branch ?? ""}
						onChange={(event) =>
							run(() =>
								checkoutGitBranch({
									workspaceId: workspaceId ?? "",
									branch: event.currentTarget.value
								})
							)
						}
						disabled={!status?.isRepo || isBusy}
						className="h-5 max-w-40 bg-transparent text-xs text-zinc-200 outline-none disabled:text-zinc-600"
						aria-label="Branch"
					>
						{status?.branches.map((branch) => (
							<option key={branch.name} value={branch.name}>
								{branch.name}
							</option>
						))}
					</select>
					<input
						value={branchDraft}
						onChange={(event) => setBranchDraft(event.currentTarget.value)}
						placeholder="new branch"
						className="h-5 w-24 border-l border-white/10 bg-transparent pl-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-700"
					/>
					<button
						type="button"
						disabled={!branchDraft.trim() || !status?.isRepo || isBusy}
						onClick={() =>
							run(async () => {
								await createGitBranch({
									workspaceId: workspaceId ?? "",
									branch: branchDraft
								})
								setBranchDraft("")
							})
						}
						className="h-5 rounded bg-white/[0.06] px-1.5 text-[11px] text-zinc-300 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:text-zinc-700"
					>
						New
					</button>
				</div>
				<GitCommitMenu workspaceId={workspaceId} />
				<span className="text-xs tabular-nums text-neutral-600">v1.1.0</span>
			</div>
			{error ? (
				<div className="absolute right-3 top-12 z-30 rounded-md border border-red-500/30 bg-red-950 px-3 py-2 text-xs text-red-200">
					{error}
				</div>
			) : null}
		</div>
	)
}
