import {
	ArrowDownUp,
	ChevronRight,
	FolderKanban,
	FolderPlus,
	GitBranch,
	GitBranchPlus,
	Trash2,
	PanelLeft
} from "lucide-react"
import type { ProjectRow, WorkspaceSortMode } from "@renderer/types/models"
import { useRef, useState, type PointerEvent } from "react"
import type { WorkspaceRow } from "src/main/db/contracts"

interface Props {
	activeProjectId: string | null
	activeWorkspaceId: string | null
	onNewProject: () => void
	onProjectDelete: (project: ProjectRow) => void
	onProjectSelect: (project: ProjectRow) => void
	onProjectReorder: (projectIds: string[]) => void
	onWorkspaceCreate: (project: ProjectRow) => void
	onWorkspaceDelete: (workspace: WorkspaceRow) => void
	onWorkspaceReorder: (workspaceIds: string[]) => void
	onWorkspaceSelect: (project: ProjectRow, workspace: WorkspaceRow) => void
	onMinimapSlot: (node: HTMLDivElement | null) => void
	onToggleSidebar: () => void
	open: boolean
	projects: ProjectRow[]
	showMinimap: boolean
	workspaceSortMode: WorkspaceSortMode
	workspacesByProjectId: Map<string, WorkspaceRow[]>
	onWorkspaceSortModeChange: (mode: WorkspaceSortMode) => void
}

const DEFAULT_SIDEBAR_WIDTH = 300
const COLLAPSED_SIDEBAR_WIDTH = 0
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 420

export default function SideBar({
	activeProjectId,
	activeWorkspaceId,
	onNewProject,
	onProjectDelete,
	onProjectReorder,
	onProjectSelect,
	onWorkspaceCreate,
	onWorkspaceDelete,
	onWorkspaceReorder,
	onWorkspaceSelect,
	onMinimapSlot,
	onToggleSidebar,
	open,
	projects,
	showMinimap,
	workspaceSortMode,
	workspacesByProjectId,
	onWorkspaceSortModeChange
}: Props) {
	const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
	const [resizing, setResizing] = useState(false)
	const [dragProjectId, setDragProjectId] = useState<string | null>(null)
	const [dragWorkspaceId, setDragWorkspaceId] = useState<string | null>(null)
	const resizeStart = useRef({ width: DEFAULT_SIDEBAR_WIDTH, x: 0 })
	const projectById = new Map(projects.map((project) => [project.id, project]))
	const orderedWorkspaces = projects.flatMap(
		(project) => workspacesByProjectId.get(project.id) ?? []
	)
	const flatWorkspaces = [...orderedWorkspaces].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
		return a.createdAt.localeCompare(b.createdAt)
	})

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

	const reorderProject = (targetProjectId: string) => {
		if (!dragProjectId || dragProjectId === targetProjectId) return
		const ids = projects.map((project) => project.id)
		const from = ids.indexOf(dragProjectId)
		const to = ids.indexOf(targetProjectId)
		if (from < 0 || to < 0) return
		const nextIds = ids.filter((id) => id !== dragProjectId)
		nextIds.splice(to, 0, dragProjectId)
		onProjectReorder(nextIds)
	}

	const reorderWorkspace = (targetWorkspaceId: string) => {
		if (!dragWorkspaceId || dragWorkspaceId === targetWorkspaceId) return
		const ids =
			workspaceSortMode === "workspace"
				? flatWorkspaces.map((workspace) => workspace.id)
				: orderedWorkspaces.map((workspace) => workspace.id)
		const from = ids.indexOf(dragWorkspaceId)
		const to = ids.indexOf(targetWorkspaceId)
		if (from < 0 || to < 0) return
		const nextIds = ids.filter((id) => id !== dragWorkspaceId)
		nextIds.splice(to, 0, dragWorkspaceId)
		onWorkspaceReorder(nextIds)
	}

	const renderWorkspace = (project: ProjectRow, workspace: WorkspaceRow, nested: boolean) => {
		const workspaceActive = activeProjectId === project.id && activeWorkspaceId === workspace.id
		return (
			<div
				key={workspace.id}
				draggable
				onDragStart={(event) => {
					event.stopPropagation()
					setDragWorkspaceId(workspace.id)
					event.dataTransfer.effectAllowed = "move"
				}}
				onDragOver={(event) => {
					if (!dragWorkspaceId || dragWorkspaceId === workspace.id) return
					event.preventDefault()
					event.stopPropagation()
					event.dataTransfer.dropEffect = "move"
				}}
				onDrop={(event) => {
					event.preventDefault()
					event.stopPropagation()
					reorderWorkspace(workspace.id)
					setDragWorkspaceId(null)
				}}
				onDragEnd={() => setDragWorkspaceId(null)}
				className={`group/workspace polished-button flex items-center rounded-md text-xs whitespace-nowrap transition-opacity duration-150 ${
					workspaceActive
						? "bg-white/8 text-neutral-100"
						: "text-neutral-600 hover:bg-white/5 hover:text-neutral-300"
				} ${dragWorkspaceId === workspace.id ? "opacity-45" : "opacity-100"}`}
			>
				<button
					type="button"
					onClick={() => onWorkspaceSelect(project, workspace)}
					className={`flex min-w-0 flex-1 cursor-pointer items-center py-2.5 text-left ${
						nested ? "px-4" : "px-2"
					}`}
					title={workspace.name}
				>
					<GitBranch size={20} className="mr-2 shrink-0 text-neutral-600" aria-hidden="true" />
					<span className="min-w-0 truncate text-[0.9rem]">{workspace.name}</span>
				</button>
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onWorkspaceDelete(workspace)
					}}
					className="polished-button mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-700 opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100 hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100"
					aria-label={`Delete workspace ${workspace.name}`}
					title="Delete workspace"
				>
					<Trash2 size={13} />
				</button>
			</div>
		)
	}

	return (
		<div
			className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-neutral-900 transition-[width] ease-in-out ${
				open ? "border-r border-white/5" : "border-r-0"
			} ${resizing ? "duration-0" : "duration-200"}`}
			style={{ width: open ? sidebarWidth : COLLAPSED_SIDEBAR_WIDTH }}
		>
			<div className="flex min-h-0 flex-1 flex-col" style={{ width: sidebarWidth }}>
				{showMinimap ? (
					<div
						className="flex justify-center border-b border-white/5 px-3 py-3 transition-opacity duration-150 ease-in-out"
						style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
					>
						<div ref={onMinimapSlot} />
					</div>
				) : null}

				<div className="flex h-10 items-center border-b border-white/5 px-3">
					<div className="flex min-w-0 flex-1 items-center gap-2 p-1 transition-opacity duration-150 ease-in-out">
						<button
							type="button"
							onClick={onToggleSidebar}
							className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
							aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
							title={open ? "Collapse sidebar" : "Expand sidebar"}
						>
							<PanelLeft size={16} />
						</button>
						<p className="min-w-0 flex-1 text-md font-medium font-raleway font-semibold tracking-widest text-neutral-500 uppercase">
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
						<button
							type="button"
							onClick={() =>
								onWorkspaceSortModeChange(workspaceSortMode === "project" ? "workspace" : "project")
							}
							className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-white/5 hover:text-white ${
								workspaceSortMode === "workspace" ? "text-blue-300" : "text-neutral-500"
							}`}
							aria-label="Toggle workspace-only ordering"
							title="Toggle workspace-only ordering"
							style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
						>
							<ArrowDownUp size={14} />
						</button>
					</div>
				</div>

				<div
					className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-3 transition-opacity duration-150 ease-in-out"
					style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
				>
					<nav className="flex flex-col gap-0.5">
						{workspaceSortMode === "workspace"
							? flatWorkspaces.map((workspace) => {
									const project = projectById.get(workspace.projectId)
									if (!project) return null
									return renderWorkspace(project, workspace, false)
								})
							: projects.map((project) => {
									const active = activeProjectId === project.id
									const workspaces = workspacesByProjectId.get(project.id) ?? []
									return (
										<div
											key={project.id}
											draggable
											onDragStart={(event) => {
												setDragProjectId(project.id)
												event.dataTransfer.effectAllowed = "move"
											}}
											onDragOver={(event) => {
												if (!dragProjectId || dragProjectId === project.id) return
												event.preventDefault()
												event.dataTransfer.dropEffect = "move"
											}}
											onDrop={(event) => {
												event.preventDefault()
												reorderProject(project.id)
												setDragProjectId(null)
											}}
											onDragEnd={() => setDragProjectId(null)}
											className={`group/project flex flex-col transition-opacity duration-150 ${
												dragProjectId === project.id ? "opacity-45" : "opacity-100"
											}`}
										>
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
													onClick={(event) => {
														event.stopPropagation()
														onWorkspaceCreate(project)
													}}
													className="mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-600 transition-colors duration-150 hover:bg-white/5 hover:text-neutral-200"
													aria-label={`Create worktree for ${project.name}`}
													title="Create worktree"
												>
													<GitBranchPlus size={14} />
												</button>
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														onProjectDelete(project)
													}}
													className="mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-700 opacity-0 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-300 group-hover/project:opacity-100 group-focus-within/project:opacity-100 focus-visible:opacity-100"
													aria-label={`Delete project ${project.name}`}
													title="Delete project"
												>
													<Trash2 size={13} />
												</button>
											</div>
											<div className="ml-5 flex flex-col gap-0.5 py-0.5">
												{workspaces.map((workspace) => renderWorkspace(project, workspace, true))}
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
