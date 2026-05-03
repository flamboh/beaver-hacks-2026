import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react"
import type { GitStatusEntry } from "@pierre/trees"
import { CheckCheck, Square, SquareCheckBig, Undo2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { acceptGitFileChanges, denyGitFileChanges } from "@renderer/agentStore"
import { ReviewFileTree } from "./ReviewFileTree"

type DiffViewStyle = "unified" | "split"
type DiffOverflow = "scroll" | "wrap"
type ReviewFileAction = "accept" | "deny" | null

const diffOptions = {
	diffIndicators: "bars" as const,
	hunkSeparators: "line-info-basic" as const,
	lineDiffType: "word" as const,
	theme: "pierre-dark" as const,
	themeType: "dark" as const,
	unsafeCSS: `
		[data-diffs-header],
		[data-diff],
		[data-file],
		[data-error-wrapper],
		[data-virtualizer-buffer] {
			--diffs-bg: #0a0a0a !important;
			--diffs-light-bg: #0a0a0a !important;
			--diffs-dark-bg: #0a0a0a !important;
			--diffs-token-light-bg: transparent;
			--diffs-token-dark-bg: transparent;
			background-color: #0a0a0a !important;
		}

		[data-diffs-header],
		[data-file-info] {
			background-color: #111111 !important;
			border-color: rgba(255, 255, 255, 0.08) !important;
			color: #d4d4d4 !important;
		}
	`
}

interface ReviewFilesWorkspaceProps {
	files: FileDiffMetadata[]
	workspaceId: string
	onMessage?: (message: string) => void
}

function diffToggleClass(active: boolean): string {
	return `h-6 rounded px-2 text-[11px] transition-colors ${
		active
			? "bg-white/10 text-neutral-100"
			: "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-300"
	}`
}

function actionLabel(action: Exclude<ReviewFileAction, null>): string {
	return action === "accept" ? "Accept" : "Deny"
}

function actionButtonClass(action: Exclude<ReviewFileAction, null>, busy: boolean): string {
	const base =
		"inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50"
	if (action === "accept") {
		return `${base} ${
			busy
				? "bg-emerald-500 text-emerald-950"
				: "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
		}`
	}
	return `${base} ${busy ? "bg-red-500 text-white" : "bg-red-500 text-white hover:bg-red-400"}`
}

function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
	const raw = fileDiff.name ?? fileDiff.prevName ?? ""
	if (raw.startsWith("a/") || raw.startsWith("b/")) return raw.slice(2)
	return raw
}

function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
	return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`
}

function countFileDiffLines(fileDiff: FileDiffMetadata): { additions: number; deletions: number } {
	return fileDiff.hunks.reduce(
		(total, hunk) => ({
			additions: total.additions + hunk.additionLines,
			deletions: total.deletions + hunk.deletionLines
		}),
		{ additions: 0, deletions: 0 }
	)
}

function toGitStatus(fileDiff: FileDiffMetadata): GitStatusEntry["status"] {
	if (fileDiff.type === "new") return "added"
	if (fileDiff.type === "deleted") return "deleted"
	if (fileDiff.type === "rename-changed" || fileDiff.type === "rename-pure") return "renamed"
	return "modified"
}

function statusLabel(fileDiff: FileDiffMetadata) {
	if (fileDiff.type === "new") return "A"
	if (fileDiff.type === "deleted") return "D"
	if (fileDiff.type === "rename-changed" || fileDiff.type === "rename-pure") return "R"
	return "M"
}

export function ReviewFilesWorkspace({ files, workspaceId, onMessage }: ReviewFilesWorkspaceProps) {
	const [diffStyle, setDiffStyle] = useState<DiffViewStyle>("unified")
	const [overflow, setOverflow] = useState<DiffOverflow>("scroll")
	const [busyAction, setBusyAction] = useState<ReviewFileAction>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
	const [selectedPaths, setSelectedPaths] = useState<readonly string[]>(() => [])
	const sortedFiles = useMemo(
		() =>
			files.toSorted((left, right) =>
				resolveFileDiffPath(left).localeCompare(resolveFileDiffPath(right), undefined, {
					numeric: true,
					sensitivity: "base"
				})
			),
		[files]
	)
	const paths = useMemo(() => sortedFiles.map(resolveFileDiffPath), [sortedFiles])
	const pathsKey = useMemo(() => paths.join("\0"), [paths])
	const reviewFilePaths = useMemo(() => new Set(paths), [paths])
	const presentCheckedPaths = useMemo(
		() => paths.filter((path) => checkedPaths.has(path)),
		[checkedPaths, paths]
	)
	const checkedPathsKey = useMemo(() => presentCheckedPaths.join("\0"), [presentCheckedPaths])
	const allChecked = paths.length > 0 && presentCheckedPaths.length === paths.length
	const gitStatus = useMemo<GitStatusEntry[]>(
		() =>
			sortedFiles.map((fileDiff) => ({
				path: resolveFileDiffPath(fileDiff),
				status: toGitStatus(fileDiff)
			})),
		[sortedFiles]
	)
	const selectedPath = selectedPaths.find((path) => reviewFilePaths.has(path)) ?? paths[0] ?? ""
	const selectedFile =
		sortedFiles.find((fileDiff) => resolveFileDiffPath(fileDiff) === selectedPath) ?? sortedFiles[0]
	const selectedStats = selectedFile ? countFileDiffLines(selectedFile) : null
	const selectedDiffOptions = useMemo(
		() => ({
			...diffOptions,
			diffStyle,
			overflow
		}),
		[diffStyle, overflow]
	)
	const actionBusy = busyAction !== null

	function applyCheckedPaths(next: Set<string>): void {
		setCheckedPaths(next)
	}

	function togglePath(path: string): void {
		const next = new Set(checkedPaths)
		if (next.has(path)) next.delete(path)
		else next.add(path)
		applyCheckedPaths(next)
	}

	function toggleAll(checked: boolean): void {
		applyCheckedPaths(checked ? new Set(paths) : new Set())
	}

	function runAction(action: Exclude<ReviewFileAction, null>): void {
		if (actionBusy || presentCheckedPaths.length === 0) return
		setActionError(null)
		setBusyAction(action)
		const targetPaths = [...presentCheckedPaths]
		const targetCount = targetPaths.length
		const noun = targetCount === 1 ? "file" : "files"
		onMessage?.(`${actionLabel(action)}ing ${targetCount} ${noun}`)
		void (
			action === "accept"
				? acceptGitFileChanges({ workspaceId, paths: targetPaths })
				: denyGitFileChanges({ workspaceId, paths: targetPaths })
		)
			.then(() => {
				applyCheckedPaths(new Set())
				onMessage?.(`${actionLabel(action)}ed ${targetCount} ${noun}`)
			})
			.catch((error) => {
				const message = error instanceof Error ? error.message : String(error)
				setActionError(message)
				onMessage?.(`${actionLabel(action)} failed`)
			})
			.finally(() => setBusyAction(null))
	}

	return (
		<section className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-4 pt-4">
			<aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-neutral-950">
				<div className="border-b border-white/8 px-3 py-2">
					<div className="flex h-6 items-center justify-between">
						<p className="text-xs font-medium text-neutral-300">Files</p>
						<p className="font-mono text-[11px] text-neutral-600">{sortedFiles.length}</p>
					</div>
					<div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
						<label
							className="inline-flex cursor-pointer items-center gap-2"
							onClick={() => toggleAll(!allChecked)}
						>
							{allChecked ? (
								<SquareCheckBig className="size-4 text-white" />
							) : (
								<Square className="size-4 text-neutral-400" />
							)}
							<span>Select all</span>
						</label>
						<span>{presentCheckedPaths.length} selected</span>
					</div>
				</div>
				<ReviewFileTree
					key={`${pathsKey}:${checkedPathsKey}`}
					checkedPaths={checkedPaths}
					gitStatus={gitStatus}
					onSelectionChange={setSelectedPaths}
					onTogglePath={togglePath}
					paths={paths}
					reviewFilePaths={reviewFilePaths}
					selectedPath={selectedPath}
				/>
			</aside>

			<div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-neutral-950">
				{selectedFile ? (
					<>
						<div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 px-3">
							<div className="flex min-w-0 items-center gap-2">
								<span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
									{statusLabel(selectedFile)}
								</span>
								<p className="truncate font-mono text-xs text-neutral-300">
									{resolveFileDiffPath(selectedFile)}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<button
									type="button"
									onClick={() => runAction("accept")}
									disabled={actionBusy || presentCheckedPaths.length === 0}
									className={actionButtonClass("accept", busyAction === "accept")}
								>
									<CheckCheck className="size-3.5" aria-hidden="true" />
									{busyAction === "accept"
										? `Accepting ${presentCheckedPaths.length}`
										: `Accept (${presentCheckedPaths.length})`}
								</button>
								<button
									type="button"
									onClick={() => runAction("deny")}
									disabled={actionBusy || presentCheckedPaths.length === 0}
									className={actionButtonClass("deny", busyAction === "deny")}
								>
									<Undo2Icon className="size-3.5" aria-hidden="true" />
									{busyAction === "deny"
										? `Denying ${presentCheckedPaths.length}`
										: `Deny (${presentCheckedPaths.length})`}
								</button>
								<div className="flex rounded-md border border-white/8 bg-white/[0.03] p-0.5">
									<button
										type="button"
										onClick={() => setDiffStyle("unified")}
										className={diffToggleClass(diffStyle === "unified")}
										aria-pressed={diffStyle === "unified"}
									>
										Unified
									</button>
									<button
										type="button"
										onClick={() => setDiffStyle("split")}
										className={diffToggleClass(diffStyle === "split")}
										aria-pressed={diffStyle === "split"}
									>
										Split
									</button>
								</div>
								<button
									type="button"
									onClick={() => setOverflow((next) => (next === "wrap" ? "scroll" : "wrap"))}
									className={diffToggleClass(overflow === "wrap")}
									aria-pressed={overflow === "wrap"}
								>
									Wrap
								</button>
								{selectedStats && (
									<p className="font-mono text-[11px] text-neutral-500">
										+{selectedStats.additions} -{selectedStats.deletions}
									</p>
								)}
							</div>
						</div>
						{actionError ? (
							<p className="border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
								{actionError}
							</p>
						) : null}
						<div className="min-h-0 flex-1 overflow-auto">
							<FileDiff
								key={buildFileDiffRenderKey(selectedFile)}
								fileDiff={selectedFile}
								options={selectedDiffOptions}
								className="block min-w-full"
								disableWorkerPool
							/>
						</div>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-neutral-500">
						No file selected.
					</div>
				)}
			</div>
		</section>
	)
}
