import { WorkbenchTab } from "@renderer/types/models"
import { useNavigate } from "react-router-dom"
import { ChevronLeft } from "lucide-react"

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
	onToggle: () => void
	setCurrentPage: (tab: WorkbenchTab) => void
}

export default function SideBar({
	currentPage,
	projectName,
	open,
	onToggle,
	setCurrentPage
}: Props) {
	const navigate = useNavigate()

	return (
		<div
			className="h-full bg-neutral-900 border-r border-white/5 flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
			style={{ width: open ? 200 : 32 }}
		>
			{/* inner wrapper is always full width — outer clips it */}
			<div className="w-[200px] flex flex-col flex-1">
				{/* header */}
				<div className="flex items-center gap-1 px-1.5 border-b border-white/5 h-[60px]">
					{/* toggle — always at left edge, stays within the 32px visible strip */}
					<button
						onClick={onToggle}
						className="w-7 h-7 flex items-center justify-center shrink-0 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors duration-150"
					>
						<ChevronLeft
							size={15}
							className="transition-transform duration-200 ease-in-out"
							style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
						/>
					</button>

					{/* project info — fades out as sidebar closes */}
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

				{/* nav content — fades out as sidebar closes */}
				<div
					className="flex flex-col flex-1 transition-opacity duration-150 ease-in-out"
					style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
				>
					<button
						onClick={() => navigate("/")}
						className="flex items-center gap-2.5 mx-2 mt-3 px-3 py-2 rounded-md text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-colors duration-150"
					>
						Gallery
					</button>

					<div className="mx-3 my-2 border-t border-white/5" />

					<nav className="flex flex-col gap-0.5 px-2">
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
