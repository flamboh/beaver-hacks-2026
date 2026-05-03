import { parsePatchFiles } from "@pierre/diffs"
import type { FileDiffMetadata } from "@pierre/diffs/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ExternalLink, Play, Square } from "lucide-react"
import { useMemo, useState } from "react"
import { generateGitDiffTour, useGitStatus } from "@renderer/agentStore"
import { buildPatchCacheKey } from "@renderer/lib/diffRendering"
import { ReviewFilesWorkspace } from "./ReviewFilesWorkspace"
import { ReviewTourPanel } from "./ReviewTourPanel"
import { saveReviewTour, useReviewTour } from "./reviewTourStore"

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

interface ReviewProps {
	enterDevAction: string
	projectName: string
	workspaceId: string
	workspacePath: string
}

const INITIAL_EMPTY_TOUR_PANEL_HEIGHT = 100
const EXPANDED_TOUR_PANEL_HEIGHT = 440

export default function Review({
	enterDevAction,
	projectName,
	workspaceId,
	workspacePath
}: ReviewProps) {
	const gitStatus = useGitStatus(workspaceId)
	const savedTour = useReviewTour(workspaceId)
	const [launching, setLaunching] = useState(false)
	const [stopping, setStopping] = useState(false)
	const [tourPanelHeight, setTourPanelHeight] = useState(() =>
		savedTour.tour ? 280 : INITIAL_EMPTY_TOUR_PANEL_HEIGHT
	)
	const [message, setMessage] = useState("Review workspace ready")
	const devServerQuery = useQuery({
		queryKey: ["dev-server", "project-status", workspacePath, projectName],
		queryFn: () => window.api.devServer.getProjectStatus({ cwd: workspacePath, name: projectName }),
		refetchInterval: 2000
	})
	const devServerRunning = devServerQuery.data?.status === "running"
	const diffQuery = useQuery({
		queryKey: ["git", "working-tree-diff", workspaceId, gitStatus?.updatedAt ?? null],
		queryFn: () => window.api.git.getWorkingTreeDiff(workspaceId),
		enabled: gitStatus?.isRepo === true,
		placeholderData: keepPreviousData
	})
	const currentPatch = diffQuery.data?.patch ?? ""
	const stablePatch = diffQuery.isPlaceholderData && diffQuery.isFetching ? undefined : currentPatch
	const renderablePatch = useMemo(() => getRenderablePatch(currentPatch, "review"), [currentPatch])
	const stableRenderablePatch = useMemo(
		() => getRenderablePatch(stablePatch, "review"),
		[stablePatch]
	)
	const currentDiffKey = useMemo(
		() => (stablePatch ? buildPatchCacheKey(stablePatch, "review-tour") : ""),
		[stablePatch]
	)
	const tourStale = Boolean(
		savedTour.tour && currentDiffKey && savedTour.diffKey !== currentDiffKey
	)

	const launchDevServer = async () => {
		setLaunching(true)
		try {
			const result = await window.api.devServer.launchProject({
				cwd: workspacePath,
				name: projectName,
				enterDevAction,
				openExternal: true
			})
			setMessage(result.message)
			void devServerQuery.refetch()
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Launch failed.")
		} finally {
			setLaunching(false)
		}
	}

	const stopDevServer = async () => {
		setStopping(true)
		try {
			const result = await window.api.devServer.stopProject({
				cwd: workspacePath,
				name: projectName
			})
			setMessage(
				result.status === "stopped" ? "Project dev server stopped." : "Project dev server stopping."
			)
			void devServerQuery.refetch()
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Stop failed.")
		} finally {
			setStopping(false)
		}
	}

	const generateTour = async () => {
		if (!currentDiffKey) return
		const previousTour = savedTour
		saveReviewTour(workspaceId, {
			...previousTour,
			error: null,
			generating: true,
			updatedAt: new Date().toISOString()
		})
		setMessage("Tour agent running")
		try {
			const result = await generateGitDiffTour(workspaceId)
			saveReviewTour(workspaceId, {
				diffKey: currentDiffKey,
				error: null,
				generating: false,
				tour: result.tour,
				updatedAt: result.updatedAt
			})
			setTourPanelHeight(EXPANDED_TOUR_PANEL_HEIGHT)
			setMessage("Tour ready")
		} catch (error) {
			saveReviewTour(workspaceId, {
				...previousTour,
				diffKey: previousTour.diffKey || currentDiffKey,
				error: error instanceof Error ? error.message : "Tour failed.",
				generating: false,
				updatedAt: new Date().toISOString()
			})
			setMessage("Tour failed")
		}
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
						{workspacePath}
					</p>
					<button
						type="button"
						onClick={launchDevServer}
						disabled={launching}
						className="flex items-center gap-2 rounded-md border border-white/10 bg-white px-3 py-2 text-sm font-medium text-neutral-950 transition-colors duration-150 hover:bg-neutral-200 disabled:cursor-wait disabled:bg-neutral-400"
					>
						{launching ? <ExternalLink size={15} /> : <Play size={15} />}
						{launching ? "Launching" : devServerRunning ? "Open" : "Dev"}
					</button>
					{devServerRunning && (
						<button
							type="button"
							onClick={stopDevServer}
							disabled={stopping}
							className="flex size-9 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-300 transition-colors duration-150 hover:bg-red-500/15 disabled:cursor-wait disabled:text-red-500"
							aria-label={stopping ? "Stopping dev server" : "Kill dev server"}
							title={stopping ? "Stopping dev server" : "Kill dev server"}
						>
							<Square size={14} />
						</button>
					)}
				</div>
			</header>

			{!gitStatus ? (
				<div className="flex flex-1 items-center justify-center text-xs text-neutral-500">
					Loading git status.
				</div>
			) : gitStatus.isRepo === false ? (
				<div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-neutral-500">
					Review diffs are unavailable outside a git repository.
				</div>
			) : diffQuery.isLoading ? (
				<div className="flex flex-1 items-center justify-center text-xs text-neutral-500">
					Loading diff.
				</div>
			) : diffQuery.error ? (
				<div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-red-300/80">
					{diffQuery.error instanceof Error ? diffQuery.error.message : "Failed to load diff."}
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

			<ReviewTourPanel
				canGenerate={Boolean(stableRenderablePatch)}
				error={savedTour.error}
				generating={savedTour.generating}
				height={tourPanelHeight}
				onGenerate={generateTour}
				onHeightChange={setTourPanelHeight}
				stale={tourStale}
				tour={savedTour.tour}
			/>
		</div>
	)
}
