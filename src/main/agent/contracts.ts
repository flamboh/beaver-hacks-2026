export type AgentRole = 'user' | 'assistant' | 'system'

export type AgentSessionStatus = 'idle' | 'starting' | 'ready' | 'running' | 'stopped' | 'error'

export type AgentRuntimeMode = 'full-access' | 'auto-accept-edits' | 'approval-required'

export interface AgentMessage {
  id: string
  role: AgentRole
  text: string
  streaming: boolean
  createdAt: string
  updatedAt: string
  turnId: string | null
}

export interface AgentActivity {
  id: string
  kind: string
  summary: string
  payload: unknown
  createdAt: string
  turnId: string | null
}

export interface AgentSession {
  status: AgentSessionStatus
  provider: 'codex'
  activeTurnId: string | null
  lastError: string | null
  updatedAt: string
}

export interface AgentThread {
  id: string
  title: string
  cwd: string
  model: string | null
  runtimeMode: AgentRuntimeMode
  messages: AgentMessage[]
  activities: AgentActivity[]
  session: AgentSession | null
  createdAt: string
  updatedAt: string
}

export interface AgentSnapshot {
  threads: AgentThread[]
  activeThreadId: string | null
  updatedAt: string
}

export interface StartTurnInput {
  threadId?: string
  cwd?: string
  prompt: string
  model?: string
  runtimeMode?: AgentRuntimeMode
}

export interface ProviderSessionStartInput {
  threadId: string
  cwd: string
  model?: string
  runtimeMode: AgentRuntimeMode
}

export interface ProviderSendTurnInput {
  threadId: string
  prompt: string
  model?: string
}

export interface ProviderTurnStartResult {
  threadId: string
  turnId: string
  resumeCursor?: unknown
}

export type ProviderRuntimeEvent =
  | {
      type: 'session.state.changed'
      threadId: string
      createdAt: string
      payload: { status: AgentSessionStatus; reason?: string }
    }
  | {
      type: 'turn.started'
      threadId: string
      turnId: string
      createdAt: string
      payload: Record<string, never>
    }
  | {
      type: 'turn.completed'
      threadId: string
      turnId: string | null
      createdAt: string
      payload: { status: 'completed' | 'failed' | 'cancelled' | 'interrupted'; error?: string }
    }
  | {
      type: 'assistant.delta'
      threadId: string
      turnId: string | null
      itemId: string | null
      createdAt: string
      payload: { delta: string }
    }
  | {
      type: 'activity'
      threadId: string
      turnId: string | null
      createdAt: string
      payload: { kind: string; summary: string; detail?: unknown }
    }
  | {
      type: 'runtime.error'
      threadId: string
      turnId: string | null
      createdAt: string
      payload: { message: string }
    }

export interface ProviderAdapter {
  startSession(input: ProviderSessionStartInput): Promise<AgentSession>
  sendTurn(input: ProviderSendTurnInput): Promise<ProviderTurnStartResult>
  stopSession(threadId: string): Promise<void>
  onEvent(listener: (event: ProviderRuntimeEvent) => void): () => void
}
