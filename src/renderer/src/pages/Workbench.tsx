import TopBar from "@renderer/components/_Workbench/TopBar"
import SideBar from "@renderer/components/_Workbench/SideBar"
import ControlPanel from "@renderer/components/_Workbench/_ControlPanel/main/ControlPanel"
import Review from "@renderer/components/_Workbench/_Review/main/Review"
import Agents from "@renderer/components/_Workbench/_Agents/main/Agents"
import Settings from "@renderer/components/_Workbench/_Settings/main/Settings"
import { useAgentSnapshot } from "@renderer/agentStore"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { ProjectRow, WorkbenchTab } from "@renderer/types/models"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
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
	const initialPage = WORKBENCH_TABS.includes(tab as WorkbenchTab)
		? (tab as WorkbenchTab)
		: "control-panel"
	const currentPage = initialPage
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const projectQuery = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => window.api.projects.get({ id: projectId ?? "" })
	})
	const projectsQuery = useQuery({
		queryKey: ["projects"],
		queryFn: () => window.api.projects.list()
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

	const selectProject = (nextProject: ProjectRow) => {
		setProject({
			id: nextProject.id,
			name: nextProject.name,
			path: nextProject.path
		})
		void window.api.projects.touch({ id: nextProject.id })
		navigate(`/project/${encodeURIComponent(nextProject.id)}/workbench/${currentPage}`)
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

	const setWorkspace = (workspaceId: string) => {
		if (!workspaceId) return
		void window.api.workspaces
			.activate({ id: workspaceId })
			.then(() => workspacesQuery.refetch())
			.catch(() => undefined)
	}

	const renderPage = () => {
		if (!project || !activeWorkspace) return null

		switch (currentPage) {
			case "control-panel":
				return (
					<ControlPanel workspaceId={activeWorkspace.id} workspacePath={activeWorkspace.path} />
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
				activeWorkspace={activeWorkspace}
				currentPage={currentPage}
				onWorkspacesChanged={() => workspacesQuery.refetch()}
				onTabChange={setProjectPage}
				onToggleSidebar={() => setSidebarOpen((open) => !open)}
				onWorkspaceChange={setWorkspace}
				projectId={project?.id ?? null}
				workspaces={workspaces}
			/>
			<div className="flex flex-1 overflow-hidden">
				<SideBar
					activeProjectId={project?.id ?? null}
					activeWorkspaceId={activeWorkspace?.id ?? null}
					onProjectSelect={selectProject}
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
		</div>
	)
}
