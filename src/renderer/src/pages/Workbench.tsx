import TopBar from "@renderer/components/_Workbench/TopBar"
import SideBar from "@renderer/components/_Workbench/SideBar"
import ControlPanel from "@renderer/components/_Workbench/_ControlPanel/main/ControlPanel"
import Review from "@renderer/components/_Workbench/_Review/main/Review"
import Agents from "@renderer/components/_Workbench/_Agents/main/Agents"
import Settings from "@renderer/components/_Workbench/_Settings/main/Settings"
import { useSessionData } from "@renderer/hooks/useSessionData"
import { WorkbenchTab } from "@renderer/types/models"
import { useState } from "react"
import { useParams } from "react-router-dom"

const WORKBENCH_TABS: WorkbenchTab[] = ["control-panel", "gallery", "review", "agents", "settings"]

export default function Workbench() {
	const { tab } = useParams()
	const { project } = useSessionData()
	const initialPage = WORKBENCH_TABS.includes(tab as WorkbenchTab)
		? (tab as WorkbenchTab)
		: "control-panel"
	const [currentPage, setCurrentPage] = useState<WorkbenchTab>(initialPage)

	const renderPage = () => {
		switch (currentPage) {
			case "control-panel":
				return <ControlPanel />
			case "review":
				return <Review />
			case "agents":
				return <Agents />
			case "settings":
				return <Settings />
			default:
				return null
		}
	}

	// ControlPanel is a full-bleed canvas — no padding or scroll wrapper
	const isCanvas = currentPage === "control-panel"

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-white">
			<TopBar />
			<div className="flex flex-1 overflow-hidden">
				<SideBar
					currentPage={currentPage}
					projectName={project?.name ?? "No project selected"}
					setCurrentPage={setCurrentPage}
				/>
				<main className={`flex-1 overflow-hidden ${isCanvas ? "" : "overflow-auto p-6"}`}>
					{renderPage()}
				</main>
			</div>
		</div>
	)
}
