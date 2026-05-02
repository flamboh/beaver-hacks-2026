import { FormEvent, useState } from 'react'

type NewProjectModalProps = {
  onCreate: (input: { name: string; path: string }) => Promise<unknown>
  onCancel?: () => void
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const remoteError = message.match(/Error invoking remote method '[^']+': Error: (.*)$/)
  return remoteError?.[1] ?? message
}

export default function NewProjectModal({ onCancel, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleBrowse(): Promise<void> {
    const selectedPath = await window.api.dialog.selectDirectory()
    if (selectedPath) {
      setPath(selectedPath)
      setError('')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedPath = path.trim()

    if (!trimmedName || !trimmedPath) {
      setError('Project name and path are required.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onCreate({ name: trimmedName, path: trimmedPath })
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 text-neutral-50">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-lg border border-neutral-700 bg-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-neutral-700 px-5 py-4">
          <h2 id="new-project-title" className="text-2xl font-semibold">
            Create a project
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer text-xl leading-none text-neutral-400 transition duration-300 hover:text-neutral-200"
            aria-label="Close create project modal"
          >
            x
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-5 py-5">
            <label className="block">
              <span className="text-sm font-medium text-neutral-50">Project name</span>
              <input
                type="text"
                name="projectName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                className="mt-2 w-full border border-neutral-600 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 outline-none transition duration-300 placeholder:text-neutral-500 focus:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-50">Project path</span>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  name="projectPath"
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="/path/to/project"
                  className="w-full border border-neutral-600 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 outline-none transition duration-300 placeholder:text-neutral-500 focus:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  disabled={isSubmitting}
                  className="cursor-pointer bg-neutral-50 px-4 py-2 text-sm font-medium text-black transition duration-300 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Browse
                </button>
              </div>
            </label>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-neutral-700 px-5 py-4">
            <p className="mr-auto text-sm text-red-400" aria-live="polite">
              {error}
            </p>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="cursor-pointer border border-neutral-600 bg-black px-4 py-2 text-sm text-neutral-50 transition duration-300 hover:border-neutral-500 hover:bg-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer bg-neutral-50 px-4 py-2 text-sm font-medium text-black transition duration-300 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create a project'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
