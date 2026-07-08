import { defineStore } from 'pinia'
import type {
  BrowserState,
  Command,
  PaletteResult,
  ResumeInfo,
  HistoryEntry
} from '../../../shared/types'

function send(cmd: Command, payload?: unknown): void {
  // Payloads pulled from store state are Vue reactive Proxies, which Electron's
  // structured clone (at the contextBridge / ipcRenderer boundary) can't
  // serialize — it throws DataCloneError. Strip reactivity to a plain object.
  window.api.send(cmd, payload === undefined ? undefined : JSON.parse(JSON.stringify(payload)))
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
    workspaceTabCounts: {} as Record<string, number>,
    dailyFocusMinutes: 0,
    pinnedSites: [],
    showPicker: true,
    showResume: false,
    resume: null as ResumeInfo | null,
    showSettings: false,
    showLeftSidebar: true,
    showRightSidebar: true,
    roles: { essential: [], reference: [], distractions: [] },
    focus: { state: 'idle', endsAt: null, workspaceId: null, paused: false, remainingMs: 0 },
    showCompletion: false,
    showPalette: false,
    paletteResults: [] as PaletteResult[],
    showNotes: false,
    noteOrigin: '',
    noteBody: '',
    activeHasNote: false,
    ambientSound: null as string | null,
    ambientDucked: false,
    showFind: false,
    findResult: { current: 0, total: 0 },
    zoomPercent: 100,
    showHistory: false,
    historyResults: [] as HistoryEntry[],
    focusUrlBarSeq: 0
  }),
  getters: {
    activeTab: (state) => state.tabs.find((t) => t.id === state.activeTabId) ?? null,
    activeDownloads: (state) => state.downloads.filter((d) => d.state === 'progressing').length,
    activeWorkspace: (state) =>
      state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? null,
    isActiveTabPinned(state): boolean {
      const url = state.tabs.find((t) => t.id === state.activeTabId)?.url
      return url ? state.pinnedSites.includes(url) : false
    }
  },
  actions: {
    apply(next: BrowserState): void {
      this.tabs = next.tabs
      this.activeTabId = next.activeTabId
      this.downloads = next.downloads
      this.permissionRequest = next.permissionRequest
      this.workspaces = next.workspaces
      this.activeWorkspaceId = next.activeWorkspaceId
      this.workspaceTabCounts = next.workspaceTabCounts
      this.dailyFocusMinutes = next.dailyFocusMinutes
      this.pinnedSites = next.pinnedSites
      this.showPicker = next.showPicker
      this.showResume = next.showResume
      this.resume = next.resume
      this.showSettings = next.showSettings
      this.showLeftSidebar = next.showLeftSidebar
      this.showRightSidebar = next.showRightSidebar
      this.roles = next.roles
      this.focus = next.focus
      this.showCompletion = next.showCompletion
      this.showPalette = next.showPalette
      this.paletteResults = next.paletteResults
      this.showNotes = next.showNotes
      this.noteOrigin = next.noteOrigin
      this.noteBody = next.noteBody
      this.activeHasNote = next.activeHasNote
      this.ambientSound = next.ambientSound
      this.ambientDucked = next.ambientDucked
      this.showFind = next.showFind
      this.findResult = next.findResult
      this.zoomPercent = next.zoomPercent
      this.showHistory = next.showHistory
      this.historyResults = next.historyResults
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
    },
    openFocusMenu(): void {
      send('focus:menu')
    },
    startFocus(minutes: number): void {
      send('focus:start', { minutes })
    },
    openFocusControlMenu(): void {
      send('focus:control')
    },
    dismissCompletion(): void {
      send('focus:dismiss')
    },
    closePalette(): void {
      send('palette:close')
    },
    toggleNotes(): void {
      send('notes:toggle')
    },
    closeNotes(): void {
      send('notes:close')
    },
    saveNote(origin: string, body: string): void {
      send('notes:save', { origin, body })
    },
    setAmbient(sound: string | null): void {
      send('ambient:set', { sound })
    },
    findQuery(text: string): void {
      send('find:query', { text })
    },
    findNext(forward: boolean): void {
      send('find:next', { forward })
    },
    closeFind(): void {
      send('find:close')
    },
    zoomReset(): void {
      send('zoom:reset')
    },
    queryHistory(query: string): void {
      send('history:query', { query })
    },
    closeHistory(): void {
      send('history:close')
    },
    toggleSidebar(side: 'left' | 'right'): void {
      send('sidebar:toggle', { side })
    },
    queryPalette(query: string): void {
      send('palette:query', { query })
    },
    runResult(result: PaletteResult): void {
      // Dispatch the result's command through the same cmd:* channel any caller
      // uses, then close the palette.
      send(result.cmd, result.payload)
      send('palette:close')
    },
    startWorkspace(id: string): void {
      send('workspace:start', { id })
    },
    switchWorkspace(id: string): void {
      send('workspace:switch', { id })
    },
    openPalette(): void {
      send('palette:open')
    },
    resumeSession(): void {
      send('session:resume')
    },
    dismissResume(): void {
      send('session:dismiss')
    },
    openSettings(): void {
      send('settings:open')
    },
    closeSettings(): void {
      send('settings:close')
    },
    addRole(role: string, pattern: string): void {
      send('roles:add', { role, pattern })
    },
    removeRole(role: string, pattern: string): void {
      send('roles:remove', { role, pattern })
    },
    pinSite(url: string): void {
      send('workspace:pin', { url })
    },
    unpinSite(url: string): void {
      send('workspace:unpin', { url })
    },
    toggleActiveTabPinned(): void {
      const url = this.activeTab?.url
      if (!url) return
      if (this.isActiveTabPinned) this.unpinSite(url)
      else this.pinSite(url)
    }
  }
})
