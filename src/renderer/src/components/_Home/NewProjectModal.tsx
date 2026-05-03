import type { ProjectRow } from "@renderer/types/models"
import { motion } from "motion/react"
import { FormEvent, useState } from "react"

type NewProjectModalProps = {
	onCreate: (input: { name: string; path: string }) => Promise<unknown>
	onCancel?: () => void
	initialProject?: ProjectRow
}

function errorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error)
	const remoteError = message.match(/Error invoking remote method '[^']+': Error: (.*)$/)
	return remoteError?.[1] ?? message
}

function nameFromPath(path: string): string {
	return path.split(/[\\/]/g).filter(Boolean).at(-1) ?? ""
}

export default function NewProjectModal({
	initialProject,
	onCancel,
	onCreate
}: NewProjectModalProps) {
	const isEditing = Boolean(initialProject)
	const [name, setName] = useState(initialProject?.name ?? "")
	const [path, setPath] = useState(initialProject?.path ?? "")
	const [error, setError] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleBrowse(): Promise<void> {
		const selectedPath = await window.api.dialog.selectDirectory()
		if (selectedPath) {
			setPath(selectedPath)
			if (!name.trim()) setName(nameFromPath(selectedPath))
			setError("")
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault()

		const trimmedPath = path.trim()
		const trimmedName = name.trim() || nameFromPath(trimmedPath)

		if (!trimmedName || !trimmedPath) {
			setError("Project name and path are required.")
			return
		}

		setIsSubmitting(true)
		setError("")

		try {
			await onCreate({ name: trimmedName, path: trimmedPath })
		} catch (createError) {
			setError(errorMessage(createError))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 text-neutral-50 backdrop-blur-sm"
		>
			<motion.section
				initial={{ opacity: 0, y: 14, scale: 0.98, filter: "blur(4px)" }}
				animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
				exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
				transition={{ type: "spring", duration: 0.32, bounce: 0 }}
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-project-title"
				className="polished-surface w-full max-w-lg rounded-lg border border-white/10 bg-neutral-900 shadow-2xl"
			>
				<header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
					<h2 id="new-project-title" className="text-base font-semibold">
						{isEditing ? `Edit ${initialProject?.name}` : "Create a project"}
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="polished-button flex size-8 cursor-pointer items-center justify-center rounded-md text-xl leading-none text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
						aria-label="Close create project modal"
					>
						x
					</button>
				</header>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4 px-5 py-5">
						<label className="block">
							<span className="text-sm font-medium text-neutral-50">Project name</span>
							<input
								type="text"
								name="projectName"
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={isSubmitting}
								className="polished-input mt-2 w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</label>

						<label className="block">
							<span className="text-sm font-medium text-neutral-50">Project path</span>
							<div className="mt-2 flex gap-2">
								<input
									type="text"
									name="projectPath"
									value={path}
									onChange={(event) => setPath(event.target.value)}
									disabled={isSubmitting}
									placeholder="/path/to/project"
									className="polished-input w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
								/>
								<button
									type="button"
									onClick={handleBrowse}
									disabled={isSubmitting}
									className="polished-button cursor-pointer rounded-md bg-neutral-50 px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
								>
									Browse
								</button>
							</div>
						</label>
					</div>

					<footer className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-4">
						<p className="mr-auto text-sm text-red-400" aria-live="polite">
							{error}
						</p>
						<button
							type="button"
							onClick={onCancel}
							disabled={isSubmitting}
							className="polished-button cursor-pointer rounded-md border border-white/10 bg-black px-4 py-2 text-sm text-neutral-50 hover:border-white/20 hover:bg-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="polished-button cursor-pointer rounded-md bg-neutral-50 px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSubmitting
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save"
									: "Create a project"}
						</button>
					</footer>
				</form>
			</motion.section>
		</motion.div>
	)
}
