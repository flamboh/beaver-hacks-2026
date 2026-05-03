import { WorkbenchTab } from "@renderer/types/models"

const navItems: { label: string; tab: WorkbenchTab }[] = [
	{ label: "Control Panel", tab: "control-panel" },
	{ label: "Review", tab: "review" },
	{ label: "Agents", tab: "agents" },
	{ label: "Settings", tab: "settings" }
]

interface Props {
	currentPage: WorkbenchTab
	projectName: string
	open: boolean
	setCurrentPage: (tab: WorkbenchTab) => void
}

export default function SideBar({ currentPage, projectName, open, setCurrentPage }: Props) {
	return (
		<div
			className="h-full bg-neutral-900 border-r border-white/5 flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
			style={{ width: open ? 250 : 0 }}
		>
			<div className="w-[250px] flex flex-col flex-1">
				<div className="flex items-center gap-1 px-1.5 border-b border-white/5 h-[60px]">
					<div
						className="flex-1 min-w-0 transition-opacity duration-150 ease-in-out p-2"
						style={{ opacity: open ? 1 : 0 }}
					>
						<p className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium mb-0.5">
							Project
						</p>
						<p className="text-sm text-blue-300 truncate font-medium">{projectName}</p>
					</div>
				</div>

				<div
					className="flex flex-col flex-1 transition-opacity duration-150 ease-in-out"
					style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
				>
					<nav className="flex flex-col gap-0.5 px-2 pt-3">
						{navItems.map(({ label, tab }) => {
							const active = currentPage === tab
							return (
								<button
									key={tab}
									onClick={() => setCurrentPage(tab)}
									className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-150 whitespace-nowrap
										${active ? "bg-white/8 text-white" : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5"}`}
								>
									{label}
								</button>
							)
						})}
					</nav>
				</div>
			</div>
		</div>
	)
}
