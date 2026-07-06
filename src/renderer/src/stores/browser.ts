import { defineStore } from 'pinia'
import type { BrowserState, Command } from '../../../shared/types'

function send(cmd: Command, payload?: unknown): void {
  window.api.send(cmd, payload)
}

// A dumb mirror of the main process's authoritative BrowserState, plus a thin
// command facade. The renderer never mutates tab data directly — it applies
// whole snapshots pushed by main and sends commands back.
export const useBrowserStore = defineStore('browser', {
  state: (): BrowserState => ({
    tabs: [],
    activeTabId: null,
    downloads: [],
    permissionRequest: null,
    workspaces: [],
    activeWorkspaceId: '',
    focusUrlBarSeq: 0
  }),
  getters: {
    activeTab: (state) => state.tabs.find((t) => t.id === state.activeTabId) ?? null,
    activeDownloads: (state) => state.downloads.filter((d) => d.state === 'progressing').length,
    activeWorkspace: (state) =>
      state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? null
  },
  actions: {
    apply(next: BrowserState): void {
      this.tabs = next.tabs
      this.activeTabId = next.activeTabId
      this.downloads = next.downloads
      this.permissionRequest = next.permissionRequest
      this.workspaces = next.workspaces
      this.activeWorkspaceId = next.activeWorkspaceId
      this.focusUrlBarSeq = next.focusUrlBarSeq
    },
    newTab(): void {
      send('tab:new')
    },
    closeTab(id: string): void {
      send('tab:close', { id })
    },
    activateTab(id: string): void {
      send('tab:activate', { id })
    },
    navigate(url: string): void {
      send('tab:navigate', { url })
    },
    back(): void {
      send('tab:back')
    },
    forward(): void {
      send('tab:forward')
    },
    reload(): void {
      send('tab:reload')
    },
    openDownload(id: string): void {
      send('download:open', { id })
    },
    cancelDownload(id: string): void {
      send('download:cancel', { id })
    },
    clearDownloads(): void {
      send('downloads:clear')
    },
    resolvePermission(id: string, granted: boolean): void {
      send('permission:resolve', { id, granted })
    },
    openWorkspaceMenu(): void {
      send('workspace:menu')
    }
  }
})
