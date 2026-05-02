import { parsePatchFiles } from "@pierre/diffs"
import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react"
import type { GitStatusEntry } from "@pierre/trees"
import { FileTree, useFileTree, useFileTreeSelection } from "@pierre/trees/react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Play, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"
import { useAgentSnapshot } from "@renderer/agentStore"
import { buildPatchCacheKey } from "@renderer/lib/diffRendering"

type RenderablePatch =
	| {
			kind: "files"
			files: FileDiffMetadata[]
	  }
	| {
			kind: "raw"
			reason: string
			text: string
	  }

const treeCSS = `
	:host {
		--trees-bg-override: #0a0a0a;
		--trees-fg-override: #d4d4d4;
		--trees-muted-fg-override: #737373;
		--trees-border-color-override: rgba(255, 255, 255, 0.08);
		--trees-hover-bg-override: rgba(255, 255, 255, 0.06);
		--trees-selected-bg-override: rgba(255, 255, 255, 0.1);
		--trees-selected-fg-override: #ffffff;
	}
`

const diffOptions = {
	diffIndicators: "bars" as const,
	diffStyle: "unified" as const,
	hunkSeparators: "line-info-basic" as const,
	lineDiffType: "word" as const,
	overflow: "scroll" as const,
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

function getRenderablePatch(
	patch: string | undefined,
	cacheScope = "review"
): RenderablePatch | null {
	const normalizedPatch = patch?.trim() ?? ""
	if (!normalizedPatch) return null

	try {
		const parsedPatches = parsePatchFiles(
			normalizedPatch,
			buildPatchCacheKey(normalizedPatch, cacheScope)
		)
		const files = parsedPatches.flatMap((parsedPatch) => parsedPatch.files)
		if (files.length > 0) return { kind: "files", files }
		return {
			kind: "raw",
			reason: "Unsupported diff format. Showing raw patch.",
			text: normalizedPatch
		}
	} catch {
		return {
			kind: "raw",
			reason: "Failed to parse patch. Showing raw patch.",
			text: normalizedPatch
		}
	}
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

function ReviewFilesWorkspace({ files }: { files: FileDiffMetadata[] }) {
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
	const reviewFilePaths = useMemo(() => new Set(paths), [paths])
	const gitStatus = useMemo<GitStatusEntry[]>(
		() =>
			sortedFiles.map((fileDiff) => ({
				path: resolveFileDiffPath(fileDiff),
				status: toGitStatus(fileDiff)
			})),
		[sortedFiles]
	)
	const tree = useFileTree({
		flattenEmptyDirectories: true,
		gitStatus,
		initialExpansion: "open",
		initialSelectedPaths: [paths[0] ?? ""],
		paths,
		search: true,
		unsafeCSS: treeCSS
	})
	const selectedPaths = useFileTreeSelection(tree.model)
	const selectedPath = selectedPaths.find((path) => reviewFilePaths.has(path)) ?? paths[0] ?? ""
	const selectedFile =
		sortedFiles.find((fileDiff) => resolveFileDiffPath(fileDiff) === selectedPath) ?? sortedFiles[0]
	const selectedStats = selectedFile ? countFileDiffLines(selectedFile) : null

	return (
		<section className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-4 pt-4">
			<aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-neutral-950">
				<div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 px-3">
					<p className="text-xs font-medium text-neutral-300">Files</p>
					<p className="font-mono text-[11px] text-neutral-600">{sortedFiles.length}</p>
				</div>
				<FileTree model={tree.model} className="min-h-0 flex-1" style={{ height: "100%" }} />
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
							{selectedStats && (
								<p className="font-mono text-[11px] text-neutral-500">
									+{selectedStats.additions} -{selectedStats.deletions}
								</p>
							)}
						</div>
						<div className="min-h-0 flex-1 overflow-auto">
							<FileDiff
								key={buildFileDiffRenderKey(selectedFile)}
								fileDiff={selectedFile}
								options={diffOptions}
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

export default function Review() {
	const snapshot = useAgentSnapshot()
	const activeThread = snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId)
	const cwd = activeThread?.cwd
	const [launching, setLaunching] = useState(false)
	const [message, setMessage] = useState("Review workspace ready")
	const [url, setUrl] = useState("https://beaver-review.localhost/#/workbench/review")
	const [output, setOutput] = useState("")
	const diffQuery = useQuery({
		queryKey: ["git", "working-tree-diff", cwd ?? null],
		queryFn: () => window.api.git.getWorkingTreeDiff(cwd),
		refetchOnWindowFocus: true
	})
	const renderablePatch = useMemo(
		() => getRenderablePatch(diffQuery.data?.patch, `review:${diffQuery.data?.updatedAt ?? ""}`),
		[diffQuery.data?.patch, diffQuery.data?.updatedAt]
	)

	const launchReview = async () => {
		setLaunching(true)
		try {
			const result = await window.api.devServer.launchReview()
			setMessage(result.message)
			setUrl(result.url)
			setOutput(result.output)
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Launch failed.")
		} finally {
			setLaunching(false)
		}
	}

	const refreshDiff = () => {
		void diffQuery.refetch()
	}

	return (
		<div className="flex h-full min-h-[720px] flex-col overflow-hidden">
			<header className="flex shrink-0 items-center justify-between border-b border-white/8 pb-4">
				<div>
					<h1 className="text-base font-semibold text-white">Review</h1>
					<p className="mt-1 text-xs text-neutral-500">
						{diffQuery.data?.isRepo === false ? "No git repository found." : message}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<p className="hidden max-w-[420px] truncate font-mono text-xs text-neutral-500 lg:block">
						{cwd ?? diffQuery.data?.cwd ?? url}
					</p>
					<button
						type="button"
						onClick={refreshDiff}
						disabled={diffQuery.isFetching}
						className="flex items-center gap-2 rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors duration-150 hover:bg-neutral-800 disabled:cursor-wait disabled:text-neutral-500"
					>
						<RefreshCw size={15} />
						{diffQuery.isFetching ? "Refreshing" : "Refresh"}
					</button>
					<button
						type="button"
						onClick={launchReview}
						disabled={launching}
						className="flex items-center gap-2 rounded-md border border-white/10 bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 disabled:cursor-wait disabled:bg-neutral-400"
					>
						{launching ? <ExternalLink size={15} /> : <Play size={15} />}
						{launching ? "Launching" : "Launch"}
					</button>
				</div>
			</header>

			{diffQuery.isLoading ? (
				<div className="flex flex-1 items-center justify-center text-xs text-neutral-500">
					Loading diff.
				</div>
			) : diffQuery.error ? (
				<div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-red-300/80">
					{diffQuery.error instanceof Error ? diffQuery.error.message : "Failed to load diff."}
				</div>
			) : diffQuery.data?.isRepo === false ? (
				<div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-neutral-500">
					Review diffs are unavailable outside a git repository.
				</div>
			) : !renderablePatch ? (
				<div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-neutral-500">
					No tracked working tree changes.
				</div>
			) : renderablePatch.kind === "files" ? (
				<ReviewFilesWorkspace
					key={buildPatchCacheKey(diffQuery.data?.patch ?? "", "review-workspace")}
					files={renderablePatch.files}
				/>
			) : (
				<div className="min-h-0 flex-1 overflow-auto pt-4">
					<p className="mb-2 text-xs text-neutral-500">{renderablePatch.reason}</p>
					<pre className="overflow-auto rounded-lg border border-white/8 bg-black p-4 text-xs leading-relaxed text-neutral-400">
						{renderablePatch.text}
					</pre>
				</div>
			)}

			{output && (
				<pre className="mt-4 max-h-32 shrink-0 overflow-auto rounded-lg border border-white/8 bg-black p-4 text-xs leading-relaxed text-neutral-500">
					{output}
				</pre>
			)}
		</div>
	)
}
