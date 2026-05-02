import { BrowserWindow, ipcMain } from 'electron'
import { AgentEngine } from './agentEngine'
import type { AgentSnapshot, StartTurnInput } from './contracts'

const SNAPSHOT_EVENT = 'agent:snapshot'

export function registerAgentIpc(engine: AgentEngine): void {
  ipcMain.handle('agent:get-snapshot', () => engine.getSnapshot())
  ipcMain.handle('agent:start-turn', (_event, input: StartTurnInput) => engine.startTurn(input))

  engine.onSnapshot((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(SNAPSHOT_EVENT, snapshot)
    }
  })
}

export type { AgentSnapshot, StartTurnInput }
export { SNAPSHOT_EVENT }
