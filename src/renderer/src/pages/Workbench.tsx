import type { JSX } from 'react'
import { useMemo, useState } from 'react'
import { findProjectSkills, installProjectSkill, useAgentSnapshot } from '../agentStore'
import { Chat } from '../components/chat'

export default function Workbench(): JSX.Element {
  const snapshot = useAgentSnapshot()
  const [isFindingSkills, setIsFindingSkills] = useState(false)
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeThread = useMemo(
    () =>
      snapshot.threads.find((thread) => thread.id === snapshot.activeThreadId) ??
      snapshot.threads.at(-1) ??
      null,
    [snapshot]
  )
  const sessionStatus = activeThread?.session?.status ?? 'idle'
  const isRunning = sessionStatus === 'starting' || sessionStatus === 'running'
  const suggestedSkills = activeThread?.suggestedSkills ?? []

  function handleSkillsClick(): void {
    if (isFindingSkills) return

    if (suggestedSkills.length > 0) {
      setSkillsOpen((open) => !open)
      return
    }

    setError(null)
    setIsFindingSkills(true)
    void findProjectSkills({
      ...(activeThread ? { threadId: activeThread.id } : {}),
      prompt: activeThread?.title
    })
      .then(() => setSkillsOpen(true))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setIsFindingSkills(false))
  }

  function handleInstallSkill(skillId: string): void {
    if (!activeThread || installingSkillId) return

    setError(null)
    setInstallingSkillId(skillId)
    void installProjectSkill({ threadId: activeThread.id, skillId })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setInstallingSkillId(null))
  }

  return (
    <main className="flex h-screen flex-col bg-[#09090b] text-[#f4f4f5]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{activeThread?.title ?? 'New chat'}</h1>
        </div>
        <div className="relative flex items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-400">
            {sessionStatus}
          </span>
          <button
            type="button"
            onClick={handleSkillsClick}
            disabled={isFindingSkills}
            className="inline-flex h-7 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-wait disabled:text-zinc-500"
          >
            {isFindingSkills ? (
              <span className="size-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-200" />
            ) : null}
            Skills
          </button>
          {skillsOpen ? (
            <div className="absolute right-0 top-9 z-10 w-80 rounded-lg border border-white/10 bg-[#111114] p-2 shadow-2xl shadow-black/40">
              {suggestedSkills.length > 0 ? (
                <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                  {suggestedSkills.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => {
                        if (!skill.installed) handleInstallSkill(skill.id)
                      }}
                      disabled={skill.installed || installingSkillId !== null}
                      className="rounded-md p-2 text-left transition hover:bg-white/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">{skill.name}</p>
                          <p className="truncate text-xs text-zinc-500">{skill.source}</p>
                        </div>
                        {installingSkillId === skill.id ? (
                          <span className="size-3 shrink-0 animate-spin rounded-full border border-zinc-600 border-t-zinc-200" />
                        ) : skill.installed ? (
                          <span className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
                            Installed
                          </span>
                        ) : (
                          <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-zinc-400">
                            Install
                          </span>
                        )}
                      </div>
                      {skill.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                          {skill.description}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-6 text-center text-sm text-zinc-500">No skills yet</p>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <Chat thread={activeThread} isRunning={isRunning} />
      {error ? <p className="px-4 pb-2 text-xs text-red-400">{error}</p> : null}
    </main>
  )
}
