import type { JSX } from "react"
import { useState } from "react"
import { ChevronDown, GitCommitHorizontal, GitPullRequestArrow } from "lucide-react"
import {
	commitAllGitChanges,
	generateGitCommitMessage,
	pushGitBranch,
	useGitStatus
} from "../agentStore"

interface GitCommitMenuProps {
	workspaceId: string | null
}

type BusyAction = "commit" | "push" | null

function formatGitLabel(files: number, ahead: number): string {
	if (files > 0) return `${files} changed`
	if (ahead > 0) return `${ahead} ahead`
	return "Git"
}

export function GitCommitMenu({ workspaceId }: GitCommitMenuProps): JSX.Element | null {
	const status = useGitStatus(workspaceId ?? "")
	const [open, setOpen] = useState(false)
	const [subject, setSubject] = useState("")
	const [body, setBody] = useState("")
	const [busy, setBusy] = useState<BusyAction>(null)
	const [error, setError] = useState<string | null>(null)
	const hasChanges = (status?.files.length ?? 0) > 0

	function run(action: BusyAction, task: () => Promise<void>): void {
		if (!workspaceId || busy) return
		setError(null)
		setBusy(action)
		void task()
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setBusy(null))
	}

	function commit(): void {
		run("commit", async () => {
			let nextSubject = subject.trim()
			let nextBody = body.trim()
			if (!nextSubject) {
				const generated = await generateGitCommitMessage(workspaceId ?? "")
				nextSubject = generated.subject
				nextBody = generated.body
			}
			await commitAllGitChanges({
				workspaceId: workspaceId ?? "",
				subject: nextSubject,
				body: nextBody
			})
			setSubject("")
			setBody("")
			setOpen(false)
		})
	}

	if (!workspaceId) return null

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((nextOpen) => !nextOpen)}
				className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07]"
			>
				<GitCommitHorizontal className="size-3.5" />
				{formatGitLabel(status?.files.length ?? 0, status?.ahead ?? 0)}
				<ChevronDown className="size-3" />
			</button>

			{open ? (
				<div className="absolute right-0 top-9 z-20 w-96 rounded-lg border border-white/10 bg-[#111114] p-3 shadow-2xl shadow-black/40">
					<div className="mb-3 flex items-center justify-between gap-3 text-xs text-zinc-400">
						<span className="truncate text-zinc-200">{status?.branch ?? "no branch"}</span>
						<span className="shrink-0">
							{status?.files.length ?? 0} files · ahead {status?.ahead ?? 0}
						</span>
					</div>

					{status && !status.isRepo ? (
						<p className="py-4 text-center text-sm text-zinc-500">No git repository.</p>
					) : (
						<div className="flex flex-col gap-2">
							<input
								value={subject}
								onChange={(event) => setSubject(event.currentTarget.value)}
								placeholder="leave empty for auto-generated message"
								className="h-9 rounded-md border border-white/10 bg-[#0f0f12] px-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/20"
							/>
							<textarea
								value={body}
								onChange={(event) => setBody(event.currentTarget.value)}
								rows={2}
								placeholder="optional commit body"
								className="min-h-14 resize-none rounded-md border border-white/10 bg-[#0f0f12] px-2 py-1.5 text-xs leading-5 text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-white/20"
							/>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									disabled={busy !== null || !hasChanges}
									onClick={commit}
									className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-2.5 text-xs font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
								>
									<GitCommitHorizontal className="size-3.5" />
									Commit
								</button>
								<button
									type="button"
									disabled={busy !== null || !status?.hasRemote}
									onClick={() => run("push", () => pushGitBranch({ workspaceId }))}
									className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-zinc-600"
								>
									<GitPullRequestArrow className="size-3.5" />
									Push
								</button>
							</div>
						</div>
					)}

					{busy ? <p className="mt-2 text-xs text-zinc-500">{busy}...</p> : null}
					{error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
				</div>
			) : null}
		</div>
	)
}
