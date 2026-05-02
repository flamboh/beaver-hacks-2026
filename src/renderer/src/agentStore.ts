import { useSyncExternalStore } from 'react'
import type { AgentSnapshot } from '../../main/agent/ipc'

const EMPTY_SNAPSHOT: AgentSnapshot = {
  threads: [],
  activeThreadId: null,
  updatedAt: ''
}

let snapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function setSnapshot(nextSnapshot: AgentSnapshot): void {
  snapshot = nextSnapshot
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const unsubscribeApi = window.api.agent.onSnapshot(setSnapshot)
  void window.api.agent.getSnapshot().then(setSnapshot)

  return () => {
    listeners.delete(listener)
    unsubscribeApi()
  }
}

function getSnapshot(): AgentSnapshot {
  return snapshot
}

export function useAgentSnapshot(): AgentSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export async function sendAgentMessage(input: {
  prompt: string
  threadId?: string
}): Promise<void> {
  const nextSnapshot = await window.api.agent.startTurn({
    ...(input.threadId ? { threadId: input.threadId } : {}),
    prompt: input.prompt,
    runtimeMode: 'full-access'
  })
  setSnapshot(nextSnapshot)
}
