import TopBar from "@renderer/components/_Workbench/TopBar"
import SideBar from "@renderer/components/_Workbench/SideBar"
import ControlPanel from "@renderer/components/_Workbench/_ControlPanel/main/ControlPanel"
import Review from "@renderer/components/_Workbench/_Review/main/Review"
import Agents from "@renderer/components/_Workbench/_Agents/main/Agents"
import Settings from "@renderer/components/_Workbench/_Settings/main/Settings"
import { WorkbenchTab } from "@renderer/types/models"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"

const WORKBENCH_TABS: WorkbenchTab[] = ["control-panel", "gallery", "review", "agents", "settings"]

export default function Workbench() {
	const { projectId, tab } = useParams()
	const navigate = useNavigate()
	const initialPage = WORKBENCH_TABS.includes(tab as WorkbenchTab)
		? (tab as WorkbenchTab)
		: "control-panel"
	const currentPage = initialPage
	const projectQuery = useQuery({
		queryKey: ["project", projectId],
		queryFn: () => window.api.projects.get({ id: projectId ?? "" })
	})
	const project = projectQuery.data

	const setProjectPage = (nextTab: WorkbenchTab) => {
		if (projectId) navigate(`/project/${encodeURIComponent(projectId)}/workbench/${nextTab}`)
	}

	const renderPage = () => {
		if (!project) return null

		switch (currentPage) {
			case "control-panel":
				return <ControlPanel projectCwd={project.path} />
			case "review":
				return <Review projectCwd={project.path} projectName={project.name} />
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
					projectName={project?.name ?? "Loading project"}
					setCurrentPage={setProjectPage}
				/>
				<main className={`flex-1 overflow-hidden ${isCanvas ? "" : "overflow-auto p-6"}`}>
					{projectQuery.isLoading ? (
						<div className="flex h-full items-center justify-center text-xs text-neutral-500">
							Loading project.
						</div>
					) : projectQuery.error ? (
						<div className="flex h-full items-center justify-center px-4 text-center text-xs text-red-300/80">
							{projectQuery.error instanceof Error
								? projectQuery.error.message
								: "Project unavailable."}
						</div>
					) : (
						renderPage()
					)}
				</main>
			</div>
		</div>
	)
}
