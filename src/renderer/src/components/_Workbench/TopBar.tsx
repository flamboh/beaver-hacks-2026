import { Tally1 } from 'lucide-react'

export default function TopBar() {
  return (
    <div className="w-full h-12 bg-neutral-800 flex items-center justify-between shrink-0 border-b border-white/10">
      <div className="w-full flex flex-row">
        <h1 className="mx-5">NULLOTH</h1>
        <Tally1 />
        <h1>Workbench</h1>
      </div>

      <h1 className="mx-5">v1.1.0</h1>
    </div>
  )
}
