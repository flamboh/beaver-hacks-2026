import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import type { ProjectRow } from "@renderer/types/models"

import NewProjectButton from "./NewProjectButton"
import NewProjectModal from "./NewProjectModal"
import ProjectButton from "./ProjectButton"

const PROJECTS_QUERY_KEY = ["projects"]

export default function Gallery() {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)

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

	const projects: ProjectRow[] = projectsQuery.data ?? []

	return (
		<main className="min-h-[calc(100vh-3.5rem)] bg-neutral-950 p-6 text-neutral-50">
			<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{projects.map((project) => (
					<ProjectButton
						key={project.id}
						name={project.name}
						accessed={project.accessed}
						onOpen={() => {
							void window.api.projects.touch({ id: project.id })
							navigate(`/project/${encodeURIComponent(project.id)}/workbench`)
						}}
					/>
				))}
				<NewProjectButton onClick={() => setIsNewProjectModalOpen(true)} />
			</section>

			{isNewProjectModalOpen && (
				<NewProjectModal
					onCancel={() => setIsNewProjectModalOpen(false)}
					onCreate={(input) => createProjectMutation.mutateAsync(input)}
				/>
			)}
		</main>
	)
}
