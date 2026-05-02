type NewProjectButtonProps = {
  onClick?: () => void
}

export default function NewProjectButton({ onClick }: NewProjectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-48 w-full cursor-pointer flex-col items-center
      justify-center gap-4 border-2 border-dashed border-neutral-800
      bg-transparent text-neutral-500 transition duration-300 hover:border-neutral-700
      hover:text-neutral-400"
    >
      <span
        className="flex size-11 items-center justify-center rounded-full
      border border-neutral-800 text-3xl transition duration-300"
      >
        +
      </span>
      <span className="text-xs font-bold tracking-wide uppercase">Create New Project</span>
    </button>
  )
}
