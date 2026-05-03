import { AlertTriangle, PanelLeft } from "lucide-react"
import logoUrl from "@renderer/assets/logo.png"
import { useNavigate } from "react-router-dom"
import type { WorkbenchTab } from "@renderer/types/models"

const navItems: { label: string; tab: WorkbenchTab }[] = [
	{ label: "Control Panel", tab: "control-panel" },
	{ label: "Review", tab: "review" },
	{ label: "Agents", tab: "agents" },
	{ label: "Skills", tab: "skills" },
	{ label: "Settings", tab: "settings" }
]

interface Props {
	activeAgentCount: number
	currentPage: WorkbenchTab
	onToggleSidebar: () => void
	onTabChange: (tab: WorkbenchTab) => void
}

export default function TopBar({
	activeAgentCount,
	currentPage,
	onToggleSidebar,
	onTabChange
}: Props) {
	const navigate = useNavigate()

	return (
		<div className="relative flex h-11 w-full shrink-0 items-center gap-3 border-b border-white/5 bg-neutral-900 px-3">
			<div className="flex min-w-0 items-center gap-2">
				<div className="flex items-center gap-2 text-sm font-medium">
					<button
						type="button"
						onClick={() => navigate("/")}
						className="group flex cursor-pointer items-center gap-2 tracking-wide text-white transition-colors duration-150 hover:text-neutral-300"
					>
						<img
							src={logoUrl}
							alt=""
							className="size-10 transition-opacity duration-150 group-hover:opacity-70"
						/>
						NULLOTH
					</button>
				</div>
				<button
					type="button"
					onClick={onToggleSidebar}
					className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
					title="Toggle sidebar"
				>
					<PanelLeft size={15} />
				</button>
			</div>
			<nav className="flex shrink-0 items-center gap-0.5">
				{navItems.map(({ label, tab }) => {
					const active = currentPage === tab
					return (
						<button
							key={tab}
							type="button"
							onClick={() => onTabChange(tab)}
							className={`cursor-pointer rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
								active
									? "bg-white/8 text-white"
									: "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
							}`}
						>
							{label}
						</button>
					)
				})}
			</nav>
			<div className="ml-auto flex min-w-0 items-center gap-2">
				{activeAgentCount > 0 ? (
					<span
						className="flex size-7 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/10 text-amber-300"
						title="Agents active in workspace"
					>
						<AlertTriangle size={14} />
					</span>
				) : null}
			</div>
		</div>
	)
}
