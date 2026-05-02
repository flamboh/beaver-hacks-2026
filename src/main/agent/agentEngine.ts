import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { CodexAdapter, assistantMessageId } from './codexAdapter'
import type {
  AgentActivity,
  AgentMessage,
  AgentSession,
  AgentSnapshot,
  AgentThread,
  ProviderRuntimeEvent,
  StartTurnInput
} from './contracts'

function nowIso(): string {
  return new Date().toISOString()
}

function newMessage(input: {
  role: AgentMessage['role']
  text: string
  turnId?: string | null
  streaming?: boolean
}): AgentMessage {
  const createdAt = nowIso()
  return {
    id: `${input.role}:${randomUUID()}`,
    role: input.role,
    text: input.text,
    streaming: input.streaming ?? false,
    turnId: input.turnId ?? null,
    createdAt,
    updatedAt: createdAt
  }
}

export class AgentEngine {
  private readonly events = new EventEmitter()
  private readonly provider: CodexAdapter
  private threads = new Map<string, AgentThread>()
  private activeThreadId: string | null = null

  constructor(options: { cwd: string }) {
    this.provider = new CodexAdapter({ cwd: options.cwd })
    this.provider.onEvent((event) => this.ingestProviderEvent(event))
  }

  getSnapshot(): AgentSnapshot {
    return {
      threads: Array.from(this.threads.values()),
      activeThreadId: this.activeThreadId,
      updatedAt: nowIso()
    }
  }

  onSnapshot(listener: (snapshot: AgentSnapshot) => void): () => void {
    this.events.on('snapshot', listener)
    return () => this.events.off('snapshot', listener)
  }

  async startTurn(input: StartTurnInput): Promise<AgentSnapshot> {
    const thread = this.ensureThread(input)
    const userMessage = newMessage({ role: 'user', text: input.prompt })
    thread.messages.push(userMessage)
    thread.updatedAt = userMessage.createdAt
    this.activeThreadId = thread.id
    this.emitSnapshot()

    try {
      const session = await this.provider.startSession({
        threadId: thread.id,
        cwd: thread.cwd,
        ...(input.model ? { model: input.model } : {}),
        runtimeMode: input.runtimeMode ?? thread.runtimeMode
      })
      this.setThreadSession(thread.id, session)

      await this.provider.sendTurn({
        threadId: thread.id,
        prompt: input.prompt,
        ...(input.model ? { model: input.model } : {})
      })
    } catch (error) {
      this.setThreadSession(thread.id, {
        status: 'error',
        provider: 'codex',
        activeTurnId: null,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: nowIso()
      })
    }

    this.emitSnapshot()
    return this.getSnapshot()
  }

  private ensureThread(input: StartTurnInput): AgentThread {
    const requestedThread = input.threadId ? this.threads.get(input.threadId) : undefined
    if (requestedThread) return requestedThread

    const createdAt = nowIso()
    const thread: AgentThread = {
      id: input.threadId ?? `thread:${randomUUID()}`,
      title: input.prompt.trim().slice(0, 80) || 'New thread',
      cwd: input.cwd ?? process.cwd(),
      model: input.model ?? null,
      runtimeMode: input.runtimeMode ?? 'full-access',
      messages: [],
      activities: [],
      session: null,
      createdAt,
      updatedAt: createdAt
    }
    this.threads.set(thread.id, thread)
    return thread
  }

  private ingestProviderEvent(event: ProviderRuntimeEvent): void {
    const thread = this.threads.get(event.threadId)
    if (!thread) return

    switch (event.type) {
      case 'session.state.changed':
        this.setThreadSession(event.threadId, {
          status: event.payload.status,
          provider: 'codex',
          activeTurnId: thread.session?.activeTurnId ?? null,
          lastError:
            event.payload.status === 'error' ? (event.payload.reason ?? 'Codex error') : null,
          updatedAt: event.createdAt
        })
        break

      case 'turn.started':
        this.setThreadSession(event.threadId, {
          status: 'running',
          provider: 'codex',
          activeTurnId: event.turnId,
          lastError: null,
          updatedAt: event.createdAt
        })
        break

      case 'assistant.delta': {
        const messageId = assistantMessageId(event.turnId, event.itemId)
        const existing = thread.messages.find((message) => message.id === messageId)
        if (existing) {
          existing.text += event.payload.delta
          existing.updatedAt = event.createdAt
        } else {
          thread.messages.push({
            id: messageId,
            role: 'assistant',
            text: event.payload.delta,
            streaming: true,
            turnId: event.turnId,
            createdAt: event.createdAt,
            updatedAt: event.createdAt
          })
        }
        break
      }

      case 'turn.completed':
        for (const message of thread.messages) {
          if (message.role === 'assistant' && message.turnId === event.turnId) {
            message.streaming = false
            message.updatedAt = event.createdAt
          }
        }
        this.setThreadSession(event.threadId, {
          status: event.payload.status === 'failed' ? 'error' : 'ready',
          provider: 'codex',
          activeTurnId: null,
          lastError: event.payload.error ?? null,
          updatedAt: event.createdAt
        })
        break

      case 'activity':
        thread.activities.push(this.toActivity(event))
        break

      case 'runtime.error':
        thread.activities.push(this.toActivity(event))
        break
    }

    thread.updatedAt = event.createdAt
    this.emitSnapshot()
  }

  private toActivity(
    event: Extract<ProviderRuntimeEvent, { type: 'activity' | 'runtime.error' }>
  ): AgentActivity {
    if (event.type === 'runtime.error') {
      return {
        id: `activity:${randomUUID()}`,
        kind: 'runtime.error',
        summary: event.payload.message,
        payload: event.payload,
        turnId: event.turnId,
        createdAt: event.createdAt
      }
    }

    return {
      id: `activity:${randomUUID()}`,
      kind: event.payload.kind,
      summary: event.payload.summary,
      payload: event.payload.detail ?? {},
      turnId: event.turnId,
      createdAt: event.createdAt
    }
  }

  private setThreadSession(threadId: string, session: AgentSession): void {
    const thread = this.threads.get(threadId)
    if (!thread) return
    thread.session = session
    thread.updatedAt = session.updatedAt
  }

  private emitSnapshot(): void {
    this.events.emit('snapshot', this.getSnapshot())
  }
}
