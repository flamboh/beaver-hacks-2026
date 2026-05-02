import { WorkbenchTab } from '@renderer/types/global'

const navItems: { label: string; key: WorkbenchTab }[] = [
  { label: 'Gallery', key: 'gallery' },
  { label: 'Control Panel', key: 'control-panel' },
  { label: 'Review', key: 'review' },
  { label: 'Agents', key: 'agents' },
  { label: 'Settings', key: 'settings' },
]

export default function SideBar({
  currentPage,
  setCurrentPage,
}: {
  currentPage: WorkbenchTab
  setCurrentPage: (tab: WorkbenchTab) => void
}) {
  return (
    <div className="w-[200px] h-full bg-neutral-800 flex flex-col py-4 gap-1 shrink-0">
      {navItems.map(({ label, key }) => {
        const active = currentPage === key
        return (
          <button
            key={key}
            onClick={() => setCurrentPage(key)}
            className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm transition-colors
              ${active ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}