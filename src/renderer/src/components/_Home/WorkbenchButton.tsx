import { useNavigate } from 'react-router-dom'

export default function WorkbenchButton() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/workbench')}
      className="cursor-pointer rounded-md bg-white px-3 py-1.5
      text-xs font-medium text-background transition hover:bg-white/80 duration-300"
    >
      Workbench
    </button>
  )
}
