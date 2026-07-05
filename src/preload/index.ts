import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type BrowserState, type Command } from '../shared/types'

// The chrome renderer gets exactly two capabilities:
//   send(cmd, payload) — fire a command at the main process
//   onState(callback)  — subscribe to authoritative state pushes from main
const api = {
  send(cmd: Command, payload?: unknown): void {
    ipcRenderer.send(IPC.command, { cmd, payload })
  },
  onState(callback: (state: BrowserState) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState): void =>
      callback(state)
    ipcRenderer.on(IPC.stateUpdate, listener)
    // Return an unsubscribe handle so the renderer can clean up.
    return () => ipcRenderer.removeListener(IPC.stateUpdate, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
