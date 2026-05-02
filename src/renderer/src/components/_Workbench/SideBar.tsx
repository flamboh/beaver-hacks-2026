import { WorkbenchTab } from '@renderer/types/models'
import { useNavigate } from 'react-router-dom'

const navItems: { label: string; tab: WorkbenchTab }[] = [
  { label: 'Control Panel', tab: 'control-panel' },
  { label: 'Review',        tab: 'review' },
  { label: 'Agents',        tab: 'agents' },
  { label: 'Settings',      tab: 'settings' },
]

interface Props {
  currentPage: WorkbenchTab
  projectName: string
  setCurrentPage: (tab: WorkbenchTab) => void
}

export default function SideBar({ currentPage, projectName, setCurrentPage }: Props) {
  const navigate = useNavigate()

  return (
    <div className="w-[200px] h-full bg-neutral-900 border-r border-white/5 flex flex-col shrink-0">

      {/* project label */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium mb-0.5">Project</p>
        <p className="text-sm text-neutral-300 truncate font-medium">{projectName}</p>
      </div>

      {/* gallery — home button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 mx-2 mt-3 px-3 py-2 rounded-md text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-colors duration-150"
      >
        Gallery
      </button>

      <div className="mx-3 my-2 border-t border-white/5" />

      {/* main nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        {navItems.map(({ label, tab }) => {
          const active = currentPage === tab
          return (
            <button
              key={tab}
              onClick={() => setCurrentPage(tab)}
              className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-150
                ${active
                  ? 'bg-white/8 text-white'
                  : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'
                }`}
            >
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
