import type { JSX } from "react"
import { useState } from "react"
import { createPortal } from "react-dom"
import {
	ChevronDown,
	CloudUpload,
	GitCommitHorizontal,
	GitPullRequestArrow,
	Info
} from "lucide-react"
import {
	checkoutGitBranch,
	createGitBranch,
	generateGitCommitMessage,
	onGitStackedActionProgress,
	runGitStackedAction,
	useGitStatus
} from "../agentStore"
import type { GitStackedAction, GitStackedActionProgressEvent } from "../../../main/git/ipc"

interface GitCommitMenuProps {
	workspaceId: string | null
	featureBranchName: string
}

interface PendingDialog {
	action: GitStackedAction
	label: string
}

type MenuItem = {
	action: GitStackedAction
	label: string
	disabled: boolean
	icon: "commit" | "push" | "pr"
}

type RunStatus = GitStackedActionProgressEvent & {
	id: string
}

function actionNeedsCommit(action: GitStackedAction): boolean {
	return action === "commit" || action === "commit_push" || action === "commit_push_pr"
}

function quickAction(input: {
	hasChanges: boolean
	ahead: number
	hasRemote: boolean
}): PendingDialog {
	if (input.hasChanges && input.hasRemote) {
		return { action: "commit_push_pr", label: "Commit, push & PR" }
	}
	if (input.hasChanges) return { action: "commit", label: "Commit" }
	if (input.ahead > 0 && input.hasRemote) return { action: "create_pr", label: "Push & PR" }
	if (input.hasRemote) return { action: "create_pr", label: "Create PR" }
	return { action: "commit", label: "Commit" }
}

function menuItems(input: {
	hasChanges: boolean
	ahead: number
	hasRemote: boolean
	isBusy: boolean
}): MenuItem[] {
	return [
		{
			action: "commit",
			label: "Commit",
			disabled: input.isBusy || !input.hasChanges,
			icon: "commit"
		},
		{
			action: "commit_push",
			label: "Commit & push",
			disabled: input.isBusy || !input.hasChanges || !input.hasRemote,
			icon: "push"
		},
		{
			action: "commit_push_pr",
			label: "Commit, push & PR",
			disabled: input.isBusy || !input.hasChanges || !input.hasRemote,
			icon: "pr"
		},
		{
			action: "create_pr",
			label: input.ahead > 0 ? "Push & PR" : "Create PR",
			disabled: input.isBusy || input.hasChanges || !input.hasRemote,
			icon: "pr"
		}
	]
}

function MenuIcon({ icon }: { icon: MenuItem["icon"] }): JSX.Element {
	if (icon === "commit") return <GitCommitHorizontal className="size-3.5" />
	if (icon === "push") return <CloudUpload className="size-3.5" />
	return <GitPullRequestArrow className="size-3.5" />
}

export function GitCommitMenu({
	workspaceId,
	featureBranchName
}: GitCommitMenuProps): JSX.Element | null {
	const status = useGitStatus(workspaceId ?? "")
	const [menuOpen, setMenuOpen] = useState(false)
	const [dialog, setDialog] = useState<PendingDialog | null>(null)
	const [subject, setSubject] = useState("")
	const [body, setBody] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [statusOpen, setStatusOpen] = useState(false)
	const [runStatuses, setRunStatuses] = useState<RunStatus[]>([])
	const hasChanges = (status?.files.length ?? 0) > 0
	const ahead = status?.ahead ?? 0
	const hasRemote = status?.hasRemote ?? false
	const isDefaultBranch = status?.branch === "main" || status?.branch === "master"
	const canSuggestFeatureBranch =
		isDefaultBranch && Boolean(featureBranchName) && status?.branch !== featureBranchName
	const featureBranchExists = Boolean(
		status?.branches.some((branch) => branch.name === featureBranchName)
	)
	const primary = quickAction({ hasChanges, ahead, hasRemote })
	const items = menuItems({ hasChanges, ahead, hasRemote, isBusy: busy })

	if (!workspaceId) return null

	function openDialog(nextDialog: PendingDialog): void {
		if (busy) return
		setError(null)
		setMenuOpen(false)
		setDialog(nextDialog)
	}

	function closeDialog(): void {
		if (busy) return
		setDialog(null)
		setSubject("")
		setBody("")
	}

	function runDialogAction(options: { checkoutFeatureBranch?: boolean } = {}): void {
		if (!workspaceId || !dialog || busy) return
		const nextActionId = crypto.randomUUID()
		setError(null)
		setRunStatuses([])
		setStatusOpen(true)
		setBusy(true)
		const unsubscribe = onGitStackedActionProgress((event) => {
			if (event.actionId !== nextActionId || event.workspaceId !== workspaceId) return
			setRunStatuses((statuses) => [
				...statuses,
				{
					...event,
					id: `${event.phase}:${event.status}:${statuses.length}`
				}
			])
		})
		void Promise.resolve()
			.then(async () => {
				if (options.checkoutFeatureBranch && featureBranchName) {
					setRunStatuses((statuses) => [
						...statuses,
						{
							id: `branch:${statuses.length}`,
							workspaceId,
							actionId: nextActionId,
							phase: "commit",
							status: "started",
							command: featureBranchExists ? "git checkout" : "git checkout -b",
							message: `Switching to ${featureBranchName}.`
						}
					])
					if (featureBranchExists) {
						await checkoutGitBranch({ workspaceId, branch: featureBranchName })
					} else {
						await createGitBranch({ workspaceId, branch: featureBranchName })
					}
					setRunStatuses((statuses) => [
						...statuses,
						{
							id: `branch:${statuses.length}`,
							workspaceId,
							actionId: nextActionId,
							phase: "commit",
							status: "finished",
							command: "git checkout",
							message: `Using ${featureBranchName}.`
						}
					])
				}
				let nextSubject = subject.trim()
				let nextBody = body.trim()
				if (actionNeedsCommit(dialog.action) && !nextSubject) {
					setRunStatuses((statuses) => [
						...statuses,
						{
							id: `generate:${statuses.length}`,
							workspaceId,
							actionId: nextActionId,
							phase: "commit",
							status: "started",
							command: "codex one-shot",
							message: "Generating commit message."
						}
					])
					const generated = await generateGitCommitMessage(workspaceId)
					nextSubject = generated.subject
					nextBody = generated.body
					setRunStatuses((statuses) => [
						...statuses,
						{
							id: `generate:${statuses.length}`,
							workspaceId,
							actionId: nextActionId,
							phase: "commit",
							status: "finished",
							command: "codex one-shot",
							message: "Commit message generated."
						}
					])
				}
				const result = await runGitStackedAction({
					workspaceId,
					actionId: nextActionId,
					action: dialog.action,
					...(nextSubject ? { subject: nextSubject } : {}),
					...(nextBody ? { body: nextBody } : {})
				})
				if (result.prUrl) window.open(result.prUrl, "_blank", "noopener,noreferrer")
				setDialog(null)
				setSubject("")
				setBody("")
			})
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => {
				unsubscribe()
				setBusy(false)
			})
	}

	return (
		<div className="relative">
			<div className="inline-flex h-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-sm text-zinc-200 shadow-sm shadow-black/20">
				<button
					type="button"
					onClick={() => openDialog(primary)}
					disabled={busy || (!hasChanges && !hasRemote)}
					className="inline-flex h-full items-center gap-2 px-3 font-medium transition-colors duration-150 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-zinc-600"
				>
					<GitPullRequestArrow className="size-4" />
					{busy ? "Running..." : primary.label}
				</button>
				<button
					type="button"
					onClick={() => setMenuOpen((open) => !open)}
					disabled={busy}
					className="inline-flex h-full w-8 items-center justify-center border-l border-white/10 transition-colors duration-150 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-zinc-600"
					aria-label="Git action options"
				>
					<ChevronDown className="size-4" />
				</button>
			</div>

			{menuOpen ? (
				<>
					<button
						type="button"
						aria-label="Close git menu"
						className="fixed inset-0 z-20 cursor-default bg-transparent"
						onClick={() => setMenuOpen(false)}
					/>
					<div className="absolute top-10 right-0 z-30 w-56 rounded-lg border border-white/10 bg-[#111114] p-1 shadow-2xl shadow-black/40">
						{items.map((item) => (
							<button
								key={item.action}
								type="button"
								disabled={item.disabled}
								onClick={() => openDialog({ action: item.action, label: item.label })}
								className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-zinc-300 transition-colors duration-150 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-zinc-700"
							>
								<MenuIcon icon={item.icon} />
								{item.label}
							</button>
						))}
					</div>
				</>
			) : null}

			{dialog
				? createPortal(
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
							<div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#111114] p-4 shadow-2xl shadow-black/60">
								<div className="mb-4 flex items-start justify-between gap-4">
									<div>
										<h2 className="text-sm font-semibold text-zinc-100">{dialog.label}</h2>
										<p className="mt-1 text-xs text-zinc-500">
											{status?.branch ?? "detached"} · {status?.files.length ?? 0} changed · {ahead}{" "}
											ahead
										</p>
									</div>
									<div className="relative flex items-center gap-1">
										<button
											type="button"
											onClick={() => setStatusOpen((open) => !open)}
											className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs text-zinc-400 transition-colors duration-150 hover:bg-white/[0.07] hover:text-zinc-100"
										>
											<Info className="size-3.5" />
											Status
										</button>
										<button
											type="button"
											onClick={closeDialog}
											className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200"
										>
											Cancel
										</button>
										{statusOpen ? (
											<div className="absolute top-9 right-0 z-10 w-80 rounded-lg border border-white/10 bg-[#0d0d10] p-2 shadow-2xl shadow-black/50">
												<p className="mb-2 text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
													Subprocess
												</p>
												{runStatuses.length === 0 ? (
													<p className="text-xs text-zinc-500">
														{busy ? "Waiting for first event." : "No subprocesses run yet."}
													</p>
												) : (
													<div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
														{runStatuses.map((runStatus) => (
															<div
																key={runStatus.id}
																className="rounded-md bg-white/[0.03] px-2 py-1.5 text-xs"
															>
																<div className="flex items-center justify-between gap-2">
																	<span className="font-medium text-zinc-300">
																		{runStatus.command}
																	</span>
																	<span
																		className={
																			runStatus.status === "finished"
																				? "text-emerald-400"
																				: "text-amber-300"
																		}
																	>
																		{runStatus.status}
																	</span>
																</div>
																<p className="mt-0.5 truncate text-zinc-500">{runStatus.message}</p>
															</div>
														))}
													</div>
												)}
											</div>
										) : null}
									</div>
								</div>

								{actionNeedsCommit(dialog.action) ? (
									<>
										{canSuggestFeatureBranch ? (
											<div className="mb-3 rounded-md border border-amber-400/20 bg-amber-400/8 p-3 text-xs text-amber-100">
												<p className="font-medium">Current branch is {status?.branch}.</p>
												<p className="mt-1 text-amber-100/70">
													Use feature branch `{featureBranchName}` for this commit flow.
												</p>
											</div>
										) : null}
										<div className="flex flex-col gap-2">
											<input
												value={subject}
												onChange={(event) => setSubject(event.currentTarget.value)}
												placeholder="Leave empty for auto-generated commit message"
												className="h-9 rounded-md border border-white/10 bg-[#0f0f12] px-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/20"
												disabled={busy}
											/>
											<textarea
												value={body}
												onChange={(event) => setBody(event.currentTarget.value)}
												rows={3}
												placeholder="Commit body (optional)"
												className="min-h-20 resize-none rounded-md border border-white/10 bg-[#0f0f12] px-2 py-1.5 text-xs leading-5 text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-white/20"
												disabled={busy}
											/>
										</div>
									</>
								) : (
									<p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">
										This will generate PR content with the mini one-shot model, then run `git push`
										and `gh pr create`.
									</p>
								)}

								{error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}

								<div className="mt-4 flex justify-end gap-2">
									<button
										type="button"
										onClick={closeDialog}
										disabled={busy}
										className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 transition-colors duration-150 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-zinc-700"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={() => runDialogAction()}
										disabled={busy}
										className="h-8 rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-950 transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
									>
										{busy ? "Running..." : dialog.label}
									</button>
									{canSuggestFeatureBranch ? (
										<button
											type="button"
											onClick={() => runDialogAction({ checkoutFeatureBranch: true })}
											disabled={busy}
											className="h-8 rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-950 transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
										>
											Switch to feature branch & run
										</button>
									) : null}
								</div>
							</div>
						</div>,
						document.body
					)
				: null}
		</div>
	)
}
