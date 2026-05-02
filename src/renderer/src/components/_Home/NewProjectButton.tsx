export default function NewProjectButton() {
  return (
    <button
      type="button"
      className="flex min-h-64 w-full cursor-pointer flex-col items-center
      justify-center gap-6 border-2 border-dashed border-neutral-700
      bg-neutral-900 text-neutral-400 transition duration-300 hover:border-neutral-600
      hover:text-neutral-300"
    >
      <span
        className="flex size-14 items-center justify-center rounded-full
      border border-neutral-600 text-4xl"
      >
        +
      </span>
      <span className="text-sm font-bold tracking-wide uppercase">Create New Project</span>
    </button>
  )
}
