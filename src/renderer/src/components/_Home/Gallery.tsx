import NewProjectButton from './NewProjectButton'
import ProjectButton from './ProjectButton'

const placeholderNow = Date.now()

export default function Gallery() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-neutral-900 p-10 text-neutral-50">
      <section className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        <ProjectButton name="Project 1" accessed={placeholderNow - 2 * 60 * 60 * 1000} />
        <ProjectButton name="Project 2" accessed={placeholderNow - 24 * 60 * 60 * 1000} />
        <ProjectButton name="Project 3" accessed={placeholderNow - 24 * 60 * 60 * 1000 * 5} />
        <ProjectButton name="Project 4" accessed={placeholderNow - 24 * 60 * 60 * 1000 * 20} />
        <NewProjectButton />
      </section>
    </main>
  )
}
