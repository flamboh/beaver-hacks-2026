import TopBar from "@renderer/components/_Workbench/TopBar"
import SideBar from "@renderer/components/_Workbench/SideBar"
import ControlPanel from "@renderer/components/_Workbench/_ControlPanel/main/ControlPanel"
import Review from "@renderer/components/_Workbench/_Review/main/Review"
import Agents from "@renderer/components/_Workbench/_Agents/main/Agents"
import Skills from "@renderer/components/_Workbench/_Skills/main/Skills"
import Settings from "@renderer/components/_Workbench/_Settings/main/Settings"
import NewProjectModal from "@renderer/components/_Home/NewProjectModal"
import type { WorkspaceLane } from "@renderer/components/_Workbench/_ControlPanel/useControlPanelAgents"
import { useAgentSnapshot } from "@renderer/agentStore"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { ProjectRow, WorkbenchTab, WorkspaceSortMode } from "@renderer/types/models"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { WorkspaceRow } from "../../../main/db/ipc"

const WORKBENCH_TABS: WorkbenchTab[] = ["control-panel", "review", "agents", "skills", "settings"]
const PAGE_TRANSITION = { type: "spring", duration: 0.32, bounce: 0 } as const
const TOAST_TRANSITION = { type: "spring", duration: 0.22, bounce: 0 } as const

type WorkbenchToast = {
	message: string
}

export default function Workbench() {
	const { projectId, tab } = useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const snapshot = useAgentSnapshot()
	const { project: sessionProject, setProject, clearProject } = useSessionData()
	const [newProjectOpen, setNewProjectOpen] = useState(false)
	const initialPage = WORKBENCH_TABS.includes(tab as WorkbenchTab)
		? (tab as WorkbenchTab)
		: "control-panel"
	const currentPage = initialPage
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [controlPanelWorkspaceId, setControlPanelWorkspaceId] = useState<string | null>(null)
	const [minimapRoot, setMinimapRoot] = useState<HTMLDivElement | null>(null)
	const [workspaceSortMode, setWorkspaceSortMode] = useState<WorkspaceSortMode>("project")
	const [toast, setToast] = useState<WorkbenchToast | null>(null)
	const projectQuery = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => window.api.projects.get({ id: projectId ?? "" }),
		enabled: Boolean(projectId)
	})
	const projectsQuery = useQuery({
		queryKey: ["projects"],
		queryFn: () => window.api.projects.list()
	})
	const createProjectMutation = useMutation({
		mutationFn: (input: { name: string; path: string }) => window.api.projects.create(input),
		onSuccess: async (nextProject) => {
			await queryClient.invalidateQueries({ queryKey: ["projects"] })
			setNewProjectOpen(false)
			setProject({
				id: nextProject.id,
				name: nextProject.name,
				path: nextProject.path,
				enterDevAction: nextProject.enterDevAction
			})
			void window.api.projects.touch({ id: nextProject.id })
			navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
		}
	})
	const project = projectQuery.data ?? (sessionProject?.id === projectId ? sessionProject : null)
	const projects = projectsQuery.data ?? []
	const projectWorkspacesQueries = useQueries({
		queries: projects.map((project) => ({
			queryKey: ["workspaces", project.id],
			queryFn: () => window.api.workspaces.list({ projectId: project.id })
		}))
	})
	const workspacesByProjectId = new Map<string, WorkspaceRow[]>(
		projects.map((project, index) => [project.id, projectWorkspacesQueries[index]?.data ?? []])
	)
	const workspacesQuery = useQuery({
		queryKey: ["workspaces", projectId],
		queryFn: () => window.api.workspaces.list({ projectId: projectId ?? "" }),
		enabled: Boolean(projectId)
	})
	const workspaces = workspacesQuery.data ?? []
	const activeWorkspace = workspaces.find((workspace) => workspace.active) ?? workspaces[0] ?? null
	const projectById = new Map(projects.map((candidate) => [candidate.id, candidate]))
	const groupedWorkspaces = projects.flatMap(
		(project) => workspacesByProjectId.get(project.id) ?? []
	)
	const orderedWorkspaces =
		workspaceSortMode === "workspace"
			? [...groupedWorkspaces].sort((a, b) => {
					if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
					return a.createdAt.localeCompare(b.createdAt)
				})
			: groupedWorkspaces
	const allWorkspaces: WorkspaceLane[] = orderedWorkspaces.flatMap((workspace) => {
		const workspaceProject = projectById.get(workspace.projectId)
		if (!workspaceProject) return []
		return [
			{
				...workspace,
				projectName: workspaceProject.name,
				projectPath: workspaceProject.path,
				projectEnterDevAction: workspaceProject.enterDevAction
			}
		]
	})
	const controlPanelLane =
		currentPage === "control-panel"
			? (allWorkspaces.find((workspace) => workspace.id === controlPanelWorkspaceId) ??
				(allWorkspaces[0] || null))
			: null
	const selectedWorkspace = controlPanelLane ?? activeWorkspace
	const selectedProject = controlPanelLane
		? (projects.find((candidate) => candidate.id === controlPanelLane.projectId) ?? project)
		: project
	const activeAgentCount = selectedWorkspace
		? snapshot.threads.filter((thread) => {
				const status = thread.session?.status
				return (
					thread.cwd === selectedWorkspace.path && (status === "starting" || status === "running")
				)
			}).length
		: 0

	const showToast = (message: string) => {
		setToast({ message })
	}

	const errorMessage = (error: unknown, fallback: string) =>
		error instanceof Error && error.message ? error.message : fallback

	const setProjectPage = (nextTab: WorkbenchTab) => {
		const targetProjectId = selectedProject?.id ?? projectId
		if (targetProjectId)
			navigate(`/project/${encodeURIComponent(targetProjectId)}/workbench/${nextTab}`)
	}

	const slugify = (value: string): string =>
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9._/-]+/g, "-")
			.replace(/^[-/]+|[-/]+$/g, "") || "worktree"

	const selectProject = (nextProject: ProjectRow) => {
		const [firstWorkspace] = workspacesByProjectId.get(nextProject.id) ?? []
		if (currentPage === "control-panel") setControlPanelWorkspaceId(firstWorkspace?.id ?? null)
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path,
			enterDevAction: nextProject.enterDevAction
		})
		void window.api.projects.touch({ id: nextProject.id })
		navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
	}

	const nextWorkspaceSlug = (
		nextProject: Pick<ProjectRow, "name" | "path">,
		existingWorkspaces: WorkspaceRow[]
	): string => {
		const projectBase = slugify(
			(nextProject.name || nextProject.path.split("/").at(-1)) ?? "project"
		)
		const base = `${projectBase}-work`
		let candidate = `${base}-${existingWorkspaces.length + 1}`
		let suffix = existingWorkspaces.length + 2
		const names = new Set(existingWorkspaces.map((workspace) => workspace.name))
		while (names.has(candidate)) {
			candidate = `${base}-${suffix}`
			suffix += 1
		}
		return candidate
	}

	const createWorkspace = (
		nextProject: Pick<ProjectRow, "id" | "name" | "path" | "enterDevAction">,
		sourceWorkspaceId?: string
	) => {
		const workspaces = workspacesByProjectId.get(nextProject.id) ?? []
		const sourceWorkspace =
			workspaces.find((workspace) => workspace.id === sourceWorkspaceId) ??
			workspaces.find((workspace) => workspace.active) ??
			workspaces[0] ??
			null
		if (!sourceWorkspace) {
			showToast("No source workspace available for this project.")
			return
		}

		const slug = nextWorkspaceSlug(nextProject, workspaces)
		void window.api.workspaces
			.create({
				projectId: nextProject.id,
				name: slug,
				branch: slug,
				sourceWorkspaceId: sourceWorkspace.id
			})
			.then((workspace) => window.api.workspaces.activate({ id: workspace.id }))
			.then(async (workspace) => {
				if (currentPage === "control-panel") setControlPanelWorkspaceId(workspace.id)
				setProject({
					id: nextProject.id,
					name: nextProject.name,
					path: nextProject.path,
					enterDevAction: nextProject.enterDevAction
				})
				await queryClient.invalidateQueries({ queryKey: ["workspaces", nextProject.id] })
				navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
				if (nextProject.id === projectId) await workspacesQuery.refetch()
			})
			.catch((error) => showToast(errorMessage(error, "Could not create workspace.")))
	}

	const reorderProjects = (projectIds: string[]) => {
		const projectIdSet = new Set(projectIds)
		const completeProjectIds = [
			...projectIds,
			...projects.map((project) => project.id).filter((id) => !projectIdSet.has(id))
		]
		queryClient.setQueryData<ProjectRow[]>(["projects"], (currentProjects) => {
			if (!currentProjects) return currentProjects
			const projectById = new Map(currentProjects.map((candidate) => [candidate.id, candidate]))
			return completeProjectIds.flatMap((id) => {
				const nextProject = projectById.get(id)
				return nextProject ? [nextProject] : []
			})
		})
		void window.api.projects
			.reorder({ ids: completeProjectIds })
			.then((nextProjects) => queryClient.setQueryData(["projects"], nextProjects))
			.catch((error) => {
				showToast(errorMessage(error, "Could not reorder projects."))
				void queryClient.invalidateQueries({ queryKey: ["projects"] })
			})
	}

	const reorderWorkspaces = (workspaceIds: string[]) => {
		const workspaceIdSet = new Set(workspaceIds)
		const completeWorkspaceIds = [
			...workspaceIds,
			...groupedWorkspaces.map((workspace) => workspace.id).filter((id) => !workspaceIdSet.has(id))
		]
		const nextSortOrderById = new Map(completeWorkspaceIds.map((id, index) => [id, index]))
		for (const project of projects) {
			queryClient.setQueryData<WorkspaceRow[]>(["workspaces", project.id], (currentWorkspaces) => {
				if (!currentWorkspaces) return currentWorkspaces
				const workspaceById = new Map(
					currentWorkspaces.map((workspace) => [
						workspace.id,
						{ ...workspace, sortOrder: nextSortOrderById.get(workspace.id) ?? workspace.sortOrder }
					])
				)
				return completeWorkspaceIds.flatMap((id) => {
					const nextWorkspace = workspaceById.get(id)
					return nextWorkspace ? [nextWorkspace] : []
				})
			})
		}
		void window.api.workspaces
			.reorder({ ids: completeWorkspaceIds })
			.then(() => {
				for (const project of projects) {
					void queryClient.invalidateQueries({ queryKey: ["workspaces", project.id] })
				}
			})
			.catch((error) => {
				showToast(errorMessage(error, "Could not reorder workspaces."))
				for (const project of projects) {
					void queryClient.invalidateQueries({ queryKey: ["workspaces", project.id] })
				}
			})
	}

	const selectWorkspace = (nextProject: ProjectRow, workspace: WorkspaceRow) => {
		if (currentPage === "control-panel") setControlPanelWorkspaceId(workspace.id)
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path,
			enterDevAction: nextProject.enterDevAction
		})
		void window.api.projects.touch({ id: nextProject.id })
		void window.api.workspaces
			.activate({ id: workspace.id })
			.then(async () => {
				await queryClient.invalidateQueries({ queryKey: ["workspaces", nextProject.id] })
				navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
			})
			.catch((error) => showToast(errorMessage(error, "Could not select workspace.")))
	}

	const activateWorkspace = (workspaceId: string) => {
		if (currentPage === "control-panel") setControlPanelWorkspaceId(workspaceId)
		if (workspaceId === activeWorkspace?.id) return
		const workspace = allWorkspaces.find((candidate) => candidate.id === workspaceId)
		const nextProject = projects.find((candidate) => candidate.id === workspace?.projectId)
		if (!workspace || !nextProject) return
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path,
			enterDevAction: nextProject.enterDevAction
		})
		void window.api.projects.touch({ id: nextProject.id })
		void window.api.workspaces
			.activate({ id: workspace.id })
			.then(async () => {
				await queryClient.invalidateQueries({ queryKey: ["workspaces", nextProject.id] })
				navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
			})
			.catch((error) => showToast(errorMessage(error, "Could not activate workspace.")))
	}

	const updateWorkspaceColor = (workspaceId: string, railColor: string) => {
		const workspace = allWorkspaces.find((candidate) => candidate.id === workspaceId)
		if (!workspace) return
		void window.api.workspaces
			.update({ id: workspaceId, railColor })
			.then(async () => {
				await queryClient.invalidateQueries({ queryKey: ["workspaces", workspace.projectId] })
				if (workspace.projectId === projectId) await workspacesQuery.refetch()
			})
			.catch((error) => showToast(errorMessage(error, "Could not update workspace color.")))
	}

	const deleteProject = (targetProject: ProjectRow, message?: string) => {
		const confirmed = window.confirm(message ?? `Delete project "${targetProject.name}"?`)
		if (!confirmed) return
		void window.api.projects
			.delete({ id: targetProject.id })
			.then(async () => {
				const nextProject = projects.find((candidate) => candidate.id !== targetProject.id) ?? null
				await queryClient.invalidateQueries({ queryKey: ["projects"] })
				queryClient.removeQueries({ queryKey: ["project", targetProject.id] })
				queryClient.removeQueries({ queryKey: ["workspaces", targetProject.id] })
				if (controlPanelLane?.projectId === targetProject.id) setControlPanelWorkspaceId(null)
				if (selectedProject?.id !== targetProject.id) return
				if (nextProject) {
					setProject({
						id: nextProject.id,
						name: nextProject.name,
						path: nextProject.path,
						enterDevAction: nextProject.enterDevAction
					})
					const [firstWorkspace] = workspacesByProjectId.get(nextProject.id) ?? []
					if (currentPage === "control-panel")
						setControlPanelWorkspaceId(firstWorkspace?.id ?? null)
					navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
				} else {
					clearProject()
					navigate("/")
				}
			})
			.catch((error) => showToast(errorMessage(error, "Could not delete project.")))
	}

	const deleteWorkspace = (workspace: WorkspaceRow) => {
		const projectWorkspaces = workspacesByProjectId.get(workspace.projectId) ?? []
		if (projectWorkspaces.length <= 1) {
			const workspaceProject = projectById.get(workspace.projectId)
			if (!workspaceProject) {
				showToast("Could not find the project for that workspace.")
				return
			}
			deleteProject(
				workspaceProject,
				`"${workspace.name}" is the only workspace in "${workspaceProject.name}". Delete the project instead?`
			)
			return
		}
		const confirmed = window.confirm(`Delete workspace "${workspace.name}"?`)
		if (!confirmed) return
		void window.api.workspaces
			.delete({ id: workspace.id })
			.then(async (result) => {
				if (currentPage === "control-panel" && controlPanelWorkspaceId === workspace.id) {
					setControlPanelWorkspaceId(result.activeWorkspace.id)
				}
				await queryClient.invalidateQueries({ queryKey: ["workspaces", workspace.projectId] })
				if (workspace.projectId === projectId) await workspacesQuery.refetch()
			})
			.catch((error) => showToast(errorMessage(error, "Could not delete workspace.")))
	}

	const renderPage = () => {
		if (!selectedProject || !selectedWorkspace) return null

		switch (currentPage) {
			case "control-panel":
				return (
					<ControlPanel
						activeWorkspaceId={selectedWorkspace.id}
						minimapRoot={minimapRoot}
						onWorkspaceActivate={activateWorkspace}
						onWorkspaceColorChange={updateWorkspaceColor}
						onWorkspaceCreate={(sourceWorkspaceId) =>
							createWorkspace(selectedProject, sourceWorkspaceId)
						}
						projectIds={projects.map((project) => project.id)}
						workspaces={allWorkspaces}
					/>
				)
			case "review":
				return (
					<Review
						enterDevAction={selectedProject.enterDevAction}
						projectName={selectedProject.name}
						workspaceId={selectedWorkspace.id}
						workspacePath={selectedWorkspace.path}
					/>
				)
			case "agents":
				return <Agents projectPath={selectedProject.path} />
			case "skills":
				return <Skills projectPath={selectedProject.path} />
			case "settings":
				return (
					<Settings
						projectId={selectedProject.id}
						onProjectChanged={async () => {
							await queryClient.invalidateQueries({ queryKey: ["project", selectedProject.id] })
							await queryClient.invalidateQueries({ queryKey: ["projects"] })
						}}
						onWorkspacesChanged={() => workspacesQuery.refetch()}
					/>
				)
			default:
				return null
		}
	}

	const isCanvas = currentPage === "control-panel"

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-white">
			<TopBar
				activeAgentCount={activeAgentCount}
				currentPage={currentPage}
				onToggleSidebar={() => setSidebarOpen((open) => !open)}
				onTabChange={setProjectPage}
				sidebarOpen={sidebarOpen}
			/>
			<div className="flex flex-1 overflow-hidden">
				<SideBar
					activeProjectId={selectedProject?.id ?? null}
					activeWorkspaceId={selectedWorkspace?.id ?? null}
					onNewProject={() => setNewProjectOpen(true)}
					onProjectDelete={deleteProject}
					onProjectReorder={reorderProjects}
					onProjectSelect={selectProject}
					onWorkspaceCreate={createWorkspace}
					onWorkspaceDelete={deleteWorkspace}
					onWorkspaceReorder={reorderWorkspaces}
					onWorkspaceSelect={selectWorkspace}
					onMinimapSlot={setMinimapRoot}
					onToggleSidebar={() => setSidebarOpen((open) => !open)}
					open={sidebarOpen}
					projects={projects}
					showMinimap={currentPage === "control-panel"}
					workspaceSortMode={workspaceSortMode}
					workspacesByProjectId={workspacesByProjectId}
					onWorkspaceSortModeChange={setWorkspaceSortMode}
				/>
				<main className="relative flex-1 overflow-hidden">
					<AnimatePresence initial={false}>
						<motion.div
							key={currentPage}
							initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
							transition={PAGE_TRANSITION}
							className={`absolute inset-0 ${isCanvas ? "overflow-hidden" : "overflow-auto p-6"}`}
						>
							{(projectQuery.isLoading || workspacesQuery.isLoading) &&
							(!selectedProject || !selectedWorkspace) ? (
								<div className="flex h-full items-center justify-center text-xs text-neutral-500">
									Loading project.
								</div>
							) : !selectedProject || !selectedWorkspace ? (
								<div className="flex h-full items-center justify-center text-xs text-neutral-500">
									Select a project or create one from the sidebar.
								</div>
							) : projectId && (projectQuery.error || workspacesQuery.error) ? (
								<div className="flex h-full items-center justify-center px-4 text-center text-xs text-red-300/80">
									{projectQuery.error instanceof Error
										? projectQuery.error.message
										: workspacesQuery.error instanceof Error
											? workspacesQuery.error.message
											: "Project unavailable."}
								</div>
							) : (
								renderPage()
							)}
						</motion.div>
					</AnimatePresence>
				</main>
			</div>
			{newProjectOpen ? (
				<NewProjectModal
					onCancel={() => setNewProjectOpen(false)}
					onCreate={(input) => createProjectMutation.mutateAsync(input)}
				/>
			) : null}
			<AnimatePresence>
				{toast ? (
					<motion.div
						key="workbench-toast"
						initial={{ opacity: 0, y: 8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.98 }}
						transition={TOAST_TRANSITION}
						className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-red-400/20 bg-neutral-900 px-4 py-3 text-sm text-red-100 shadow-2xl shadow-black/40"
						role="alert"
					>
						<span className="min-w-0 flex-1">{toast.message}</span>
						<button
							type="button"
							onClick={() => setToast(null)}
							className="-mr-1 flex size-5 shrink-0 items-center justify-center rounded text-red-200/60 transition-colors duration-150 hover:bg-white/5 hover:text-red-100"
							aria-label="Dismiss"
						>
							<X size={13} />
						</button>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}
