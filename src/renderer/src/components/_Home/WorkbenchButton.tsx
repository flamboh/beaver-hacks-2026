import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'

export default function WorkbenchButton(): JSX.Element {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/workbench')}
      className="cursor-pointer rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-85"
    >
      Go to workbench
    </button>
  )
}
