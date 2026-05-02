import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AgentSnapshot,
  FindSkillsInput,
  InstallSkillInput,
  StartTurnInput
} from '../main/agent/ipc'

interface BeaverApi {
  agent: {
    getSnapshot: () => Promise<AgentSnapshot>
    startTurn: (input: StartTurnInput) => Promise<AgentSnapshot>
    findSkills: (input: FindSkillsInput) => Promise<AgentSnapshot>
    installSkill: (input: InstallSkillInput) => Promise<AgentSnapshot>
    onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: BeaverApi
  }
}
