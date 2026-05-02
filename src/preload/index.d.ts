import { ElectronAPI } from '@electron-toolkit/preload'
import type { AgentSnapshot, StartTurnInput } from '../main/agent/ipc'

interface BeaverApi {
  agent: {
    getSnapshot: () => Promise<AgentSnapshot>
    startTurn: (input: StartTurnInput) => Promise<AgentSnapshot>
    onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: BeaverApi
  }
}
