import { MultiFileDiff } from "@pierre/diffs/react"
import type { GitStatusEntry } from "@pierre/trees"
import { FileTree, useFileTree, useFileTreeSelection } from "@pierre/trees/react"
import { ExternalLink, Play } from "lucide-react"
import { useState } from "react"

type ReviewFile = {
	path: string
	status: "added" | "deleted" | "modified"
	additions: number
	deletions: number
	oldContents: string
	newContents: string
}

const REVIEW_FILES: ReviewFile[] = [
	{
		path: "src/main/agent/agentEngine.ts",
		status: "modified",
		additions: 19,
		deletions: 8,
		oldContents: `export class AgentEngine {
	async run(prompt: string) {
		const child = spawn("codex", ["exec", prompt])
		return child
	}
}`,
		newContents: `export class AgentEngine {
	async run(prompt: string, cwd: string) {
		const child = spawn("codex", ["exec", prompt], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"]
		})
		return child
	}
}`
	},
	{
		path: "src/main/git/gitService.ts",
		status: "added",
		additions: 42,
		deletions: 0,
		oldContents: "",
		newContents: `import { execFile } from "node:child_process"

export class GitService {
	async status(cwd: string) {
		const result = await runGit(cwd, ["status", "--porcelain=v2", "--branch"])
		return parseStatus(result.stdout)
	}
}`
	},
	{
		path: "src/renderer/src/components/_Workbench/_Review/main/Review.tsx",
		status: "modified",
		additions: 31,
		deletions: 12,
		oldContents: `export default function Review() {
	return (
		<div className="mx-auto max-w-3xl">
			<h1>Review</h1>
		</div>
	)
}`,
		newContents: `export default function Review() {
	return (
		<div className="grid h-full grid-cols-[280px_1fr]">
			<FileTree model={model} />
			<MultiFileDiff oldFile={oldFile} newFile={newFile} />
		</div>
	)
}`
	}
]

const paths = REVIEW_FILES.map((file) => file.path)
const reviewFilePaths = new Set(paths)
const gitStatus: GitStatusEntry[] = REVIEW_FILES.map((file) => ({
	path: file.path,
	status: file.status === "added" ? "added" : file.status === "deleted" ? "deleted" : "modified"
}))

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
	theme: "pierre-dark" as const,
	unsafeCSS: `
		:host {
			--diffs-background: #0a0a0a;
			font-size: 12px;
		}

		[data-header] {
			background: #111111;
			border-color: rgba(255, 255, 255, 0.08);
		}
	`
}

function statusLabel(status: ReviewFile["status"]) {
	if (status === "added") return "A"
	if (status === "deleted") return "D"
	return "M"
}

export default function Review() {
	const [launching, setLaunching] = useState(false)
	const [message, setMessage] = useState("Review workspace ready")
	const [url, setUrl] = useState("https://beaver-review.localhost/#/workbench/review")
	const [output, setOutput] = useState("")
	const tree = useFileTree({
		flattenEmptyDirectories: true,
		gitStatus,
		initialExpansion: "open",
		initialSelectedPaths: [REVIEW_FILES[0].path],
		paths,
		search: true,
		unsafeCSS: treeCSS
	})
	const selectedPaths = useFileTreeSelection(tree.model)
	const selectedPath =
		selectedPaths.find((path) => reviewFilePaths.has(path)) ?? REVIEW_FILES[0].path
	const selectedFile = REVIEW_FILES.find((file) => file.path === selectedPath) ?? REVIEW_FILES[0]

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

	return (
		<div className="flex h-full min-h-[720px] flex-col overflow-hidden">
			<header className="flex shrink-0 items-center justify-between border-b border-white/8 pb-4">
				<div>
					<h1 className="text-base font-semibold text-white">Review</h1>
					<p className="mt-1 text-xs text-neutral-500">{message}</p>
				</div>
				<div className="flex items-center gap-3">
					<p className="hidden max-w-[420px] truncate font-mono text-xs text-neutral-500 lg:block">
						{url}
					</p>
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

			<section className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-4 pt-4">
				<aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-neutral-950">
					<div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 px-3">
						<p className="text-xs font-medium text-neutral-300">Files</p>
						<p className="font-mono text-[11px] text-neutral-600">{REVIEW_FILES.length}</p>
					</div>
					<FileTree
						model={tree.model}
						className="min-h-0 flex-1"
						style={{ height: "100%" }}
						renderContextMenu={(item) => (
							<div className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 shadow-xl">
								{item.path}
							</div>
						)}
					/>
				</aside>

				<div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-neutral-950">
					<div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 px-3">
						<div className="flex min-w-0 items-center gap-2">
							<span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400">
								{statusLabel(selectedFile.status)}
							</span>
							<p className="truncate font-mono text-xs text-neutral-300">{selectedFile.path}</p>
						</div>
						<p className="font-mono text-[11px] text-neutral-500">
							+{selectedFile.additions} -{selectedFile.deletions}
						</p>
					</div>
					<div className="min-h-0 flex-1 overflow-auto">
						<MultiFileDiff
							oldFile={{
								name: selectedFile.path,
								contents: selectedFile.oldContents
							}}
							newFile={{
								name: selectedFile.path,
								contents: selectedFile.newContents
							}}
							options={diffOptions}
							className="block min-w-full"
							disableWorkerPool
						/>
					</div>
				</div>
			</section>

			{output && (
				<pre className="mt-4 max-h-32 shrink-0 overflow-auto rounded-lg border border-white/8 bg-black p-4 text-xs leading-relaxed text-neutral-500">
					{output}
				</pre>
			)}
		</div>
	)
}
