import { useState } from "react"
import { AlertTriangle, GitBranch, GitFork, PanelLeft, Tally1, Trash2 } from "lucide-react"
import { checkoutGitBranch, createGitBranch, useGitStatus } from "@renderer/agentStore"
import logoUrl from "@renderer/assets/logo.png"
import { GitCommitMenu } from "../GitCommitMenu"
import type { WorkspaceRow } from "src/main/db/contracts"
import { useNavigate } from "react-router-dom"
import type { WorkbenchTab } from "@renderer/types/models"

const navItems: { label: string; tab: WorkbenchTab }[] = [
	{ label: "Control Panel", tab: "control-panel" },
	{ label: "Review", tab: "review" },
	{ label: "Agents", tab: "agents" },
	{ label: "Settings", tab: "settings" }
]

interface Props {
	activeAgentCount: number
	activeWorkspace: WorkspaceRow | null
	currentPage: WorkbenchTab
	onWorkspacesChanged: () => Promise<unknown>
	onToggleSidebar: () => void
	onTabChange: (tab: WorkbenchTab) => void
	onWorkspaceChange: (workspaceId: string) => void
	projectId: string | null
	workspaces: WorkspaceRow[]
}

export default function TopBar({
	activeAgentCount,
	activeWorkspace,
	currentPage,
	onWorkspacesChanged,
	onToggleSidebar,
	onTabChange,
	onWorkspaceChange,
	projectId,
	workspaces
}: Props) {
	const navigate = useNavigate()
	const workspaceId = activeWorkspace?.id ?? null
	const status = useGitStatus(workspaceId ?? "")
	const [branchDraft, setBranchDraft] = useState("")
	const [isBusy, setIsBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	function slugify(value: string): string {
		return (
			value
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9._/-]+/g, "-")
				.replace(/^[-/]+|[-/]+$/g, "") || "worktree"
		)
	}

	function run(task: () => Promise<void>): void {
		if (!workspaceId || isBusy) return
		setError(null)
		setIsBusy(true)
		void task()
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	function createWorktree(): void {
		if (!projectId || !workspaceId || isBusy) return
		const baseSlug = slugify(status?.branch ?? activeWorkspace?.name ?? "worktree")
		const slug = `${baseSlug}-${Date.now().toString(36).slice(-5)}`
		setError(null)
		setIsBusy(true)
		void window.api.workspaces
			.create({
				projectId,
				name: slug,
				branch: slug,
				sourceWorkspaceId: workspaceId
			})
			.then((workspace) => window.api.workspaces.activate({ id: workspace.id }))
			.then((workspace) => {
				void onWorkspacesChanged()
				onWorkspaceChange(workspace.id)
			})
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	function deleteWorkspace(): void {
		if (!workspaceId || workspaces.length <= 1 || isBusy) return
		const confirmed = window.confirm(`Delete workspace "${activeWorkspace?.name ?? "current"}"?`)
		if (!confirmed) return
		setError(null)
		setIsBusy(true)
		void window.api.workspaces
			.delete({ id: workspaceId })
			.then((result) => {
				void onWorkspacesChanged()
				onWorkspaceChange(result.activeWorkspace.id)
			})
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setIsBusy(false))
	}

	return (
		<div className="relative flex h-11 w-full shrink-0 items-center justify-between border-b border-white/5 bg-neutral-900 px-3">
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-2 text-sm font-medium">
					<button
						type="button"
						onClick={() => navigate("/")}
						className="group flex cursor-pointer items-center gap-2 tracking-wide text-white transition-colors duration-150 hover:text-neutral-300"
					>
						<img
							src={logoUrl}
							alt=""
							className="size-10 transition-opacity duration-150 group-hover:opacity-70"
						/>
						NULLOTH
					</button>
					<Tally1 size={14} className="text-neutral-600" />
					<span className="text-neutral-400">Workbench</span>
				</div>
				<button
					type="button"
					onClick={onToggleSidebar}
					className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
					title="Toggle sidebar"
				>
					<PanelLeft size={15} />
				</button>
			</div>
			<nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5">
				{navItems.map(({ label, tab }) => {
					const active = currentPage === tab
					return (
						<button
							key={tab}
							type="button"
							onClick={() => onTabChange(tab)}
							className={`cursor-pointer rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
								active
									? "bg-white/8 text-white"
									: "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
							}`}
						>
							{label}
						</button>
					)
				})}
			</nav>
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
				<button
					type="button"
					disabled={!projectId || !workspaceId || isBusy}
					onClick={createWorktree}
					className="inline-flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
					aria-label="Create worktree"
					title="Create worktree"
				>
					<GitFork size={14} />
				</button>
				<button
					type="button"
					disabled={!workspaceId || workspaces.length <= 1 || isBusy}
					onClick={deleteWorkspace}
					className="inline-flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:text-zinc-700"
					aria-label="Delete workspace"
					title="Delete workspace"
				>
					<Trash2 size={14} />
				</button>
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
