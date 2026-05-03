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
import type { ProjectRow, WorkbenchTab } from "@renderer/types/models"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { WorkspaceRow } from "../../../main/db/ipc"

const WORKBENCH_TABS: WorkbenchTab[] = ["control-panel", "review", "agents", "skills", "settings"]
const PAGE_TRANSITION = { type: "spring", duration: 0.32, bounce: 0 } as const

export default function Workbench() {
	const { projectId, tab } = useParams()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const snapshot = useAgentSnapshot()
	const { project: sessionProject, setProject } = useSessionData()
	const [newProjectOpen, setNewProjectOpen] = useState(false)
	const initialPage = WORKBENCH_TABS.includes(tab as WorkbenchTab)
		? (tab as WorkbenchTab)
		: "control-panel"
	const currentPage = initialPage
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [controlPanelWorkspaceId, setControlPanelWorkspaceId] = useState<string | null>(null)
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
	const stableProjects = [...projects].sort((a, b) => {
		const createdOrder = a.createdAt.localeCompare(b.createdAt)
		if (createdOrder !== 0) return createdOrder
		return a.name.localeCompare(b.name)
	})
	const allWorkspaces: WorkspaceLane[] = stableProjects.flatMap((project) => {
		const projectWorkspaces = workspacesByProjectId.get(project.id) ?? []
		return [...projectWorkspaces]
			.sort((a, b) => {
				const createdOrder = a.createdAt.localeCompare(b.createdAt)
				if (createdOrder !== 0) return createdOrder
				return a.name.localeCompare(b.name)
			})
			.map((workspace) => ({
				...workspace,
				projectName: project.name,
				projectPath: project.path,
				projectEnterDevAction: project.enterDevAction
			}))
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
		if (!sourceWorkspace) return

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
			.catch(() => undefined)
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
			.catch(() => undefined)
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
			.catch(() => undefined)
	}

	const deleteWorkspace = (workspace: WorkspaceRow) => {
		const projectWorkspaces = workspacesByProjectId.get(workspace.projectId) ?? []
		if (projectWorkspaces.length <= 1) return
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
			.catch(() => undefined)
	}

	const renderPage = () => {
		if (!selectedProject || !selectedWorkspace) return null

		switch (currentPage) {
			case "control-panel":
				return (
					<ControlPanel
						activeWorkspaceId={selectedWorkspace.id}
						onWorkspaceActivate={activateWorkspace}
						onWorkspaceCreate={(sourceWorkspaceId) =>
							createWorkspace(selectedProject, sourceWorkspaceId)
						}
						projectIds={stableProjects.map((project) => project.id)}
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
				onTabChange={setProjectPage}
			/>
			<div className="flex flex-1 overflow-hidden">
				<SideBar
					activeProjectId={selectedProject?.id ?? null}
					activeWorkspaceId={selectedWorkspace?.id ?? null}
					onNewProject={() => setNewProjectOpen(true)}
					onProjectSelect={selectProject}
					onToggleSidebar={() => setSidebarOpen((open) => !open)}
					onWorkspaceCreate={createWorkspace}
					onWorkspaceDelete={deleteWorkspace}
					onWorkspaceSelect={selectWorkspace}
					open={sidebarOpen}
					projects={projects}
					workspacesByProjectId={workspacesByProjectId}
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
		</div>
	)
}
