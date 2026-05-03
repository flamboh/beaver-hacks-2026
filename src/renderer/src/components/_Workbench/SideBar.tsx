import type { ProjectRow } from "@renderer/types/models"

interface Props {
	activeProjectId: string | null
	onProjectSelect: (project: ProjectRow) => void
	open: boolean
	projects: ProjectRow[]
}

export default function SideBar({ activeProjectId, onProjectSelect, open, projects }: Props) {
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
							return (
								<button
									key={project.id}
									type="button"
									onClick={() => onProjectSelect(project)}
									className={`flex cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors duration-150 ${
										active
											? "bg-white/8 text-white"
											: "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
									}`}
									title={project.name}
								>
									<span className="min-w-0 truncate">{project.name}</span>
								</button>
							)
						})}
					</nav>
				</div>
			</div>
		</div>
	)
}
