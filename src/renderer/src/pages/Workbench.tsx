import TopBar from "@renderer/components/_Workbench/TopBar"
import SideBar from "@renderer/components/_Workbench/SideBar"

// Rendered imports
import ControlPanel from "@renderer/components/_Workbench/_ControlPanel/main/ControlPanel"
import Review from "@renderer/components/_Workbench/_Review/main/Review"
import Agents from "@renderer/components/_Workbench/_Agents/main/Agents"
import Settings from "@renderer/components/_Workbench/_Settings/main/Settings"

import { WorkbenchTab } from "@renderer/types/global"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Workbench() {
  const [currentPage, setCurrentPage] = useState<WorkbenchTab>("control-panel")
  const navigate = useNavigate()

  const getContent = () => {
    switch (currentPage) {
      case "gallery":
        navigate("/")
      case "control-panel":
        return <ControlPanel />
      case "agents":
        return <Agents />
      case "review":
        return <Review />
      case "settings":
        return <Settings />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SideBar currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <main className="flex-1 overflow-auto m-6">{getContent()}</main>
      </div>
    </div>
  )
}
