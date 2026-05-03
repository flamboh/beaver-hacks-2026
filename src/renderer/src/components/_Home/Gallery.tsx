import { type MouseEvent, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { ProjectRow } from "@renderer/types/models"
import { useNavigate } from "react-router-dom"

import NewProjectButton from "./NewProjectButton"
import NewProjectModal from "./NewProjectModal"
import ProjectButton from "./ProjectButton"

const PROJECTS_QUERY_KEY = ["projects"]

export default function Gallery() {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const { setProject } = useSessionData()
	const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
	const [editingProject, setEditingProject] = useState<ProjectRow | null>(null)
	const [projectMenu, setProjectMenu] = useState<{
		project: ProjectRow
		x: number
		y: number
	} | null>(null)

	const projectsQuery = useQuery({
		queryKey: PROJECTS_QUERY_KEY,
		queryFn: () => window.api.projects.list()
	})

	const createProjectMutation = useMutation({
		mutationFn: (input: { name: string; path: string }) => window.api.projects.create(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
			setIsNewProjectModalOpen(false)
		}
	})

	const updateProjectMutation = useMutation({
		mutationFn: (input: { id: string; name: string; path: string }) =>
			window.api.projects.update(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
			setEditingProject(null)
		}
	})

	const deleteProjectMutation = useMutation({
		mutationFn: (project: ProjectRow) => window.api.projects.delete({ id: project.id }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
			setProjectMenu(null)
		}
	})

	const projects: ProjectRow[] = projectsQuery.data ?? []

	const selectProject = (project: ProjectRow): void => {
		setProject({
			id: project.id,
			name: project.name,
			path: project.path
		})
		void window.api.projects.touch({ id: project.id })
		navigate(`/project/${encodeURIComponent(project.id)}/workbench`)
	}

	const openProjectMenu = (event: MouseEvent<HTMLButtonElement>, project: ProjectRow) => {
		event.preventDefault()
		setProjectMenu({ project, x: event.clientX, y: event.clientY })
	}

	const editProject = (project: ProjectRow) => {
		setProjectMenu(null)
		setEditingProject(project)
	}

	return (
		<main
			className="min-h-[calc(100vh-3.5rem)] bg-neutral-950 p-6 text-neutral-50"
			onPointerDown={() => setProjectMenu(null)}
		>
			<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{projects.map((project, index) => (
					<ProjectButton
						key={project.id}
						name={project.name}
						path={project.path}
						accessed={project.accessed}
						animationDelay={index * 0.045}
						onClick={() => selectProject(project)}
						onContextMenu={(event) => openProjectMenu(event, project)}
					/>
				))}
				<NewProjectButton
					animationDelay={projects.length * 0.045}
					onClick={() => setIsNewProjectModalOpen(true)}
				/>
			</section>

			{projectMenu && (
				<div
					className="fixed z-50 min-w-36 overflow-hidden rounded-md border border-white/10 bg-neutral-900 py-1 shadow-2xl"
					onPointerDown={(event) => event.stopPropagation()}
					style={{ left: projectMenu.x, top: projectMenu.y }}
				>
					<button
						type="button"
						onClick={() => editProject(projectMenu.project)}
						className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-neutral-200 transition duration-300 hover:bg-white/8 hover:text-white"
					>
						Edit
					</button>
					<button
						type="button"
						onClick={() => deleteProjectMutation.mutate(projectMenu.project)}
						className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-neutral-400 transition duration-300 hover:bg-white/8 hover:text-white"
					>
						Delete
					</button>
				</div>
			)}

			{isNewProjectModalOpen && (
				<NewProjectModal
					onCancel={() => setIsNewProjectModalOpen(false)}
					onCreate={(input) => createProjectMutation.mutateAsync(input)}
				/>
			)}

			{editingProject && (
				<NewProjectModal
					initialProject={editingProject}
					onCancel={() => setEditingProject(null)}
					onCreate={(input) =>
						updateProjectMutation.mutateAsync({
							id: editingProject.id,
							...input
						})
					}
				/>
			)}
		</main>
	)
}
