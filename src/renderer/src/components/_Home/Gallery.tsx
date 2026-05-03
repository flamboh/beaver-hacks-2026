import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSessionData } from "@renderer/hooks/useSessionData"
import type { ProjectRow } from "@renderer/types/models"
import { motion } from "motion/react"
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

	const selectProject = (project: ProjectRow): void => {
		setProject({
			id: project.id,
			name: project.name,
			path: project.path
		})
		navigate("/workbench")
	}

	return (
		<main className="min-h-[calc(100vh-3.5rem)] bg-neutral-950 p-6 text-neutral-50">
			<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{projects.map((project, index) => (
					<motion.div
						key={project.id}
						initial={{ opacity: 0, y: 32 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.36, delay: index * 0.1, ease: "easeOut" }}
					>
						<ProjectButton
							name={project.name}
							accessed={project.accessed}
							onClick={() => selectProject(project)}
						/>
					</motion.div>
				))}
				<motion.div
					initial={{ opacity: 0, y: 32 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.36, delay: projects.length * 0.1, ease: "easeOut" }}
				>
					<NewProjectButton onClick={() => setIsNewProjectModalOpen(true)} />
				</motion.div>
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
