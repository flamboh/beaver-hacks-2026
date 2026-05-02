import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'

export default function WorkbenchButton(): JSX.Element {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/workbench')}
      className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-xs font-medium text-background transition duration-300 hover:bg-white/80"
    >
      Workbench
    </button>
  )
}
