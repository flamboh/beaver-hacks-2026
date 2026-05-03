import TopBar from "@renderer/components/_Workbench/TopBar"
import SideBar from "@renderer/components/_Workbench/SideBar"
import ControlPanel from "@renderer/components/_Workbench/_ControlPanel/main/ControlPanel"
import Review from "@renderer/components/_Workbench/_Review/main/Review"
import Agents from "@renderer/components/_Workbench/_Agents/main/Agents"
import Settings from "@renderer/components/_Workbench/_Settings/main/Settings"
import NewProjectModal from "@renderer/components/_Home/NewProjectModal"
import type { WorkspaceLane } from "@renderer/components/_Workbench/_ControlPanel/useControlPanelAgents"
import { useAgentSnapshot } from "@renderer/agentStore"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { ProjectRow, WorkbenchTab } from "@renderer/types/models"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { WorkspaceRow } from "../../../main/db/ipc"

const WORKBENCH_TABS: WorkbenchTab[] = ["control-panel", "review", "agents", "settings"]

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
				path: nextProject.path
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
			.map((workspace) => ({ ...workspace, projectName: project.name }))
	})
	const activeAgentCount = activeWorkspace
		? snapshot.threads.filter((thread) => {
				const status = thread.session?.status
				return (
					thread.cwd === activeWorkspace.path && (status === "starting" || status === "running")
				)
			}).length
		: 0

	const setProjectPage = (nextTab: WorkbenchTab) => {
		if (projectId) navigate(`/project/${encodeURIComponent(projectId)}/workbench/${nextTab}`)
	}

	const slugify = (value: string): string =>
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9._/-]+/g, "-")
			.replace(/^[-/]+|[-/]+$/g, "") || "worktree"

	const selectProject = (nextProject: ProjectRow) => {
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path
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
		nextProject: Pick<ProjectRow, "id" | "name" | "path">,
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
			.then(async () => {
				setProject({
					id: nextProject.id,
					name: nextProject.name,
					path: nextProject.path
				})
				await queryClient.invalidateQueries({ queryKey: ["workspaces", nextProject.id] })
				navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
				if (nextProject.id === projectId) await workspacesQuery.refetch()
			})
			.catch(() => undefined)
	}

	const selectWorkspace = (nextProject: ProjectRow, workspace: WorkspaceRow) => {
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path
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
		if (workspaceId === activeWorkspace?.id) return
		const workspace = allWorkspaces.find((candidate) => candidate.id === workspaceId)
		const nextProject = projects.find((candidate) => candidate.id === workspace?.projectId)
		if (!workspace || !nextProject) return
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path
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
			.then(async () => {
				await queryClient.invalidateQueries({ queryKey: ["workspaces", workspace.projectId] })
				if (workspace.projectId === projectId) await workspacesQuery.refetch()
			})
			.catch(() => undefined)
	}

	const renderPage = () => {
		if (!project || !activeWorkspace) return null

		switch (currentPage) {
			case "control-panel":
				return (
					<ControlPanel
						activeWorkspaceId={activeWorkspace.id}
						onWorkspaceActivate={activateWorkspace}
						onWorkspaceCreate={(sourceWorkspaceId) => createWorkspace(project, sourceWorkspaceId)}
						projectIds={stableProjects.map((project) => project.id)}
						workspaces={allWorkspaces}
					/>
				)
			case "review":
				return (
					<Review
						projectName={project.name}
						workspaceId={activeWorkspace.id}
						workspacePath={activeWorkspace.path}
					/>
				)
			case "agents":
				return <Agents projectPath={project.path} />
			case "settings":
				return (
					<Settings projectId={project.id} onWorkspacesChanged={() => workspacesQuery.refetch()} />
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
				activeProject={project}
				activeWorkspace={activeWorkspace}
				currentPage={currentPage}
				onTabChange={setProjectPage}
				onToggleSidebar={() => setSidebarOpen((open) => !open)}
			/>
			<div className="flex flex-1 overflow-hidden">
				<SideBar
					activeProjectId={project?.id ?? null}
					activeWorkspaceId={activeWorkspace?.id ?? null}
					onNewProject={() => setNewProjectOpen(true)}
					onProjectSelect={selectProject}
					onWorkspaceCreate={createWorkspace}
					onWorkspaceDelete={deleteWorkspace}
					onWorkspaceSelect={selectWorkspace}
					open={sidebarOpen}
					projects={projects}
					workspacesByProjectId={workspacesByProjectId}
				/>
				<main className={`flex-1 overflow-hidden ${isCanvas ? "" : "overflow-auto p-6"}`}>
					{(projectQuery.isLoading || workspacesQuery.isLoading) &&
					(!project || !activeWorkspace) ? (
						<div className="flex h-full items-center justify-center text-xs text-neutral-500">
							Loading project.
						</div>
					) : !projectId ? (
						<div className="flex h-full items-center justify-center text-xs text-neutral-500">
							Select a project or create one from the sidebar.
						</div>
					) : projectQuery.error || workspacesQuery.error ? (
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
