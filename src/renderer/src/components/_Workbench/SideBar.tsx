import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { ProjectRow } from "@renderer/types/models"
import type { WorkspaceRow } from "../../../../main/db/ipc"

interface Props {
	activeProjectId: string | null
	activeWorkspaceId: string | null
	onProjectSelect: (project: ProjectRow) => void
	onWorkspaceSelect: (project: ProjectRow, workspace: WorkspaceRow) => void
	open: boolean
	projects: ProjectRow[]
	workspacesByProjectId: Map<string, WorkspaceRow[]>
}

function sortWorkspaces(workspaces: WorkspaceRow[]) {
	return [...workspaces].sort((a, b) => {
		const createdOrder = a.createdAt.localeCompare(b.createdAt)
		if (createdOrder !== 0) {
			return createdOrder
		}
		return a.name.localeCompare(b.name)
	})
}

export default function SideBar({
	activeProjectId,
	activeWorkspaceId,
	onProjectSelect,
	onWorkspaceSelect,
	open,
	projects,
	workspacesByProjectId
}: Props) {
	const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set())
	const toggleProject = (projectId: string) => {
		setExpandedProjectIds((current) => {
			if (current.has(projectId)) {
				return new Set()
			}
			const next = new Set<string>()
			next.add(projectId)
			return next
		})
	}
	const selectProject = (project: ProjectRow) => {
		toggleProject(project.id)
		onProjectSelect(project)
	}

	return (
		<div
			className="flex h-full shrink-0 flex-col overflow-hidden border-r border-white/5 bg-neutral-900 transition-[width] duration-200 ease-in-out"
			style={{ width: open ? 220 : 0 }}
		>
			<div className="flex w-[220px] flex-1 flex-col">
				<div className="flex h-[60px] items-center border-b border-white/5 px-3">
					<div
						className="min-w-0 flex-1 p-1 transition-opacity duration-150 ease-in-out"
						style={{ opacity: open ? 1 : 0 }}
					>
						<p className="mb-0.5 text-[10px] font-medium tracking-widest text-neutral-600 uppercase">
							Projects
						</p>
						<p className="text-sm font-medium text-neutral-300">{projects.length} total</p>
					</div>
				</div>

				<div
					className="min-h-0 flex-1 overflow-y-auto px-2 py-3 transition-opacity duration-150 ease-in-out"
					style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
				>
					<nav className="flex flex-col gap-0.5">
						{projects.map((project) => {
							const active = activeProjectId === project.id
							const expanded = expandedProjectIds.has(project.id)
							const workspaces = sortWorkspaces(workspacesByProjectId.get(project.id) ?? [])
							return (
								<div key={project.id} className="flex flex-col">
									<div
										className={`flex items-center rounded-md text-sm whitespace-nowrap transition-colors duration-150 ${
											active
												? "bg-white/8 text-white"
												: "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
										}`}
									>
										<button
											type="button"
											onClick={() => toggleProject(project.id)}
											className="flex size-8 shrink-0 cursor-pointer items-center justify-center text-neutral-500 transition-colors duration-150 hover:text-neutral-200"
											aria-label={
												expanded ? "Collapse project workspaces" : "Expand project workspaces"
											}
											title={expanded ? "Collapse" : "Expand"}
										>
											<ChevronRight
												size={14}
												className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
											/>
										</button>
										<button
											type="button"
											onClick={() => selectProject(project)}
											className="flex min-w-0 flex-1 cursor-pointer items-center py-2 pr-3 text-left"
											title={project.name}
										>
											<span className="min-w-0 truncate">{project.name}</span>
										</button>
									</div>
									<AnimatePresence initial={false}>
										{expanded ? (
											<motion.div
												key="workspaces"
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: "auto", opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
												className="ml-5 overflow-hidden"
											>
												<motion.div
													initial={{ y: -4 }}
													animate={{ y: 0 }}
													exit={{ y: -4 }}
													transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
													className="flex flex-col gap-0.5 py-0.5"
												>
													{workspaces.map((workspace) => {
														const workspaceActive =
															activeProjectId === project.id && activeWorkspaceId === workspace.id
														return (
															<button
																key={workspace.id}
																type="button"
																onClick={() => onWorkspaceSelect(project, workspace)}
																className={`flex cursor-pointer items-center rounded-md px-4 py-2.5 text-left text-xs whitespace-nowrap transition-colors duration-150 ${
																	workspaceActive
																		? "bg-white/8 text-neutral-100"
																		: "text-neutral-600 hover:bg-white/5 hover:text-neutral-300"
																}`}
																title={workspace.name}
															>
																<span className="min-w-0 truncate">{workspace.name}</span>
															</button>
														)
													})}
												</motion.div>
											</motion.div>
										) : null}
									</AnimatePresence>
								</div>
							)
						})}
					</nav>
				</div>
			</div>
		</div>
	)
}
