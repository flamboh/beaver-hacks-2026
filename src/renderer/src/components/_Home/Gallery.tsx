import { useState } from "react"

import NewProjectButton from "./NewProjectButton"
import NewProjectModal from "./NewProjectModal"
import ProjectButton from "./ProjectButton"

const placeholderNow = Date.now()

export default function Gallery() {
	const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)

	return (
		<main className="min-h-[calc(100vh-3.5rem)] bg-neutral-950 p-6 text-neutral-50">
			<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				<ProjectButton name="Project 1" accessed={placeholderNow - 2 * 60 * 60 * 1000} />
				<ProjectButton name="Project 2" accessed={placeholderNow - 24 * 60 * 60 * 1000} />
				<ProjectButton name="Project 3" accessed={placeholderNow - 24 * 60 * 60 * 1000 * 5} />
				<ProjectButton name="Project 4" accessed={placeholderNow - 24 * 60 * 60 * 1000 * 20} />
				<NewProjectButton onClick={() => setIsNewProjectModalOpen(true)} />
			</section>

			{isNewProjectModalOpen && (
				<NewProjectModal
					onCancel={() => setIsNewProjectModalOpen(false)}
					onCreate={() => setIsNewProjectModalOpen(false)}
				/>
			)}
		</main>
	)
}
