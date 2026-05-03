import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react"
import type { GitStatusEntry } from "@pierre/trees"
import { FileTree, useFileTree, useFileTreeSelection } from "@pierre/trees/react"
import { useMemo } from "react"

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

export function ReviewFilesWorkspace({ files }: { files: FileDiffMetadata[] }) {
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
