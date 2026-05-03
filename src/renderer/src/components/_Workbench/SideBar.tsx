import {
	ChevronRight,
	FolderKanban,
	FolderPlus,
	GitBranch,
	GitBranchPlus,
	Trash2
} from "lucide-react"
import type { ProjectRow } from "@renderer/types/models"
import { useRef, useState, type PointerEvent } from "react"
import type { WorkspaceRow } from "src/main/db/contracts"

interface Props {
	activeProjectId: string | null
	activeWorkspaceId: string | null
	onNewProject: () => void
	onProjectSelect: (project: ProjectRow) => void
	onWorkspaceCreate: (project: ProjectRow) => void
	onWorkspaceDelete: (workspace: WorkspaceRow) => void
	onWorkspaceSelect: (project: ProjectRow, workspace: WorkspaceRow) => void
	open: boolean
	projects: ProjectRow[]
	workspacesByProjectId: Map<string, WorkspaceRow[]>
}

const DEFAULT_SIDEBAR_WIDTH = 300
const COLLAPSED_SIDEBAR_WIDTH = 0
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 420

function sortWorkspaces(workspaces: WorkspaceRow[]) {
	return [...workspaces].sort((a, b) => {
		const recencyOrder = b.lastPromptedAt.localeCompare(a.lastPromptedAt)
		if (recencyOrder !== 0) return recencyOrder
		return a.name.localeCompare(b.name)
	})
}

function sortProjects(projects: ProjectRow[]) {
	return [...projects].sort((a, b) => {
		const createdOrder = a.createdAt.localeCompare(b.createdAt)
		if (createdOrder !== 0) return createdOrder
		return a.name.localeCompare(b.name)
	})
}

export default function SideBar({
	activeProjectId,
	activeWorkspaceId,
	onNewProject,
	onProjectSelect,
	onWorkspaceCreate,
	onWorkspaceDelete,
	onWorkspaceSelect,
	open,
	projects,
	workspacesByProjectId
}: Props) {
	const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
	const [resizing, setResizing] = useState(false)
	const resizeStart = useRef({ width: DEFAULT_SIDEBAR_WIDTH, x: 0 })

	const selectProject = (project: ProjectRow) => {
		onProjectSelect(project)
	}

	const startResize = (event: PointerEvent<HTMLDivElement>) => {
		resizeStart.current = { width: sidebarWidth, x: event.clientX }
		setResizing(true)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const resize = (event: PointerEvent<HTMLDivElement>) => {
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
		const nextWidth = resizeStart.current.width + event.clientX - resizeStart.current.x
		setSidebarWidth(clampSidebarWidth(nextWidth))
	}

	const stopResize = () => {
		setResizing(false)
	}

	return (
		<div
			className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-neutral-900 transition-[width] ease-in-out ${
				open ? "border-r border-white/5" : "border-r-0"
			} ${resizing ? "duration-0" : "duration-200"}`}
			style={{ width: open ? sidebarWidth : COLLAPSED_SIDEBAR_WIDTH }}
		>
			<div className="flex min-h-0 flex-1 flex-col" style={{ width: sidebarWidth }}>
				<div className="flex h-10 items-center border-b border-white/5 px-3">
					<div className="flex min-w-0 flex-1 items-center gap-2 p-1 transition-opacity duration-150 ease-in-out">
						<p className="min-w-0 flex-1 text-md font-medium tracking-widest text-neutral-500 uppercase">
							Projects
						</p>
						<button
							type="button"
							onClick={onNewProject}
							className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
							aria-label="Create project"
							title="Create project"
							style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
						>
							<FolderPlus size={"1.4rem"} />
						</button>
					</div>
				</div>

				<div
					className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-3 transition-opacity duration-150 ease-in-out"
					style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
				>
					<nav className="flex flex-col gap-0.5">
						{sortProjects(projects).map((project) => {
							const active = activeProjectId === project.id
							const workspaces = sortWorkspaces(workspacesByProjectId.get(project.id) ?? [])
							return (
								<div key={project.id} className="flex flex-col">
									<div
										className={`polished-button flex items-center rounded-md text-[1rem] whitespace-nowrap ${
											active
												? "bg-white/8 text-white"
												: "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
										}`}
									>
										<button
											type="button"
											onClick={() => selectProject(project)}
											className="flex size-8 shrink-0 cursor-pointer items-center justify-center text-neutral-500 transition-colors duration-150 hover:text-neutral-200"
											aria-label={`Select ${project.name}`}
											title={project.name}
										>
											<ChevronRight size={14} className="rotate-90" />
										</button>
										<button
											type="button"
											onClick={() => selectProject(project)}
											className="flex min-w-0 flex-1 cursor-pointer items-center py-2 pr-3 text-left"
											title={project.name}
										>
											<FolderKanban
												size={14}
												className="mr-2 shrink-0 text-neutral-500"
												aria-hidden="true"
											/>
											<span className="min-w-0 truncate">{project.name}</span>
										</button>
										<button
											type="button"
											onClick={() => onWorkspaceCreate(project)}
											className="mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-600 transition-colors duration-150 hover:bg-white/5 hover:text-neutral-200"
											aria-label={`Create worktree for ${project.name}`}
											title="Create worktree"
										>
											<GitBranchPlus size={14} />
										</button>
									</div>
									<div className="ml-5 flex flex-col gap-0.5 py-0.5">
										{workspaces.map((workspace) => {
											const workspaceActive =
												activeProjectId === project.id && activeWorkspaceId === workspace.id
											return (
												<div
													key={workspace.id}
													className={`group/workspace polished-button flex items-center rounded-md text-xs whitespace-nowrap ${
														workspaceActive
															? "bg-white/8 text-neutral-100"
															: "text-neutral-600 hover:bg-white/5 hover:text-neutral-300"
													}`}
												>
													<button
														type="button"
														onClick={() => onWorkspaceSelect(project, workspace)}
														className="flex min-w-0 flex-1 cursor-pointer items-center px-4 py-2.5 text-left"
														title={workspace.name}
													>
														<GitBranch
															size={20}
															className="mr-2 shrink-0 text-neutral-600"
															aria-hidden="true"
														/>
														<span className="min-w-0 truncate text-[0.9rem]">{workspace.name}</span>
													</button>
													<button
														type="button"
														onClick={() => onWorkspaceDelete(workspace)}
														className="polished-button mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-700 opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100 hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100"
														aria-label={`Delete workspace ${workspace.name}`}
														title="Delete workspace"
													>
														<Trash2 size={13} />
													</button>
												</div>
											)
										})}
									</div>
								</div>
							)
						})}
					</nav>
				</div>
			</div>
			<div
				role="separator"
				aria-orientation="vertical"
				aria-valuemin={MIN_SIDEBAR_WIDTH}
				aria-valuemax={MAX_SIDEBAR_WIDTH}
				aria-valuenow={sidebarWidth}
				onPointerDown={startResize}
				onPointerMove={resize}
				onPointerUp={stopResize}
				onPointerCancel={stopResize}
				onLostPointerCapture={stopResize}
				className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none bg-transparent transition-colors duration-150 hover:bg-white/8"
				style={{ pointerEvents: open ? "auto" : "none" }}
				title="Resize sidebar"
			/>
		</div>
	)
}

function clampSidebarWidth(width: number): number {
	return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}
