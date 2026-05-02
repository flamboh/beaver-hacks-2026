import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AgentSnapshot, StartTurnInput } from '../main/agent/ipc'

// Custom APIs for renderer
const api = {
  agent: {
    getSnapshot: (): Promise<AgentSnapshot> => ipcRenderer.invoke('agent:get-snapshot'),
    startTurn: (input: StartTurnInput): Promise<AgentSnapshot> =>
      ipcRenderer.invoke('agent:start-turn', input),
    onSnapshot: (listener: (snapshot: AgentSnapshot) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: AgentSnapshot): void => {
        listener(snapshot)
      }
      ipcRenderer.on('agent:snapshot', handler)
      return () => ipcRenderer.off('agent:snapshot', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
