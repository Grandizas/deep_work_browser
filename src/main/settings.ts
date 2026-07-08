import Store from 'electron-store'
import type { FocusPersisted } from './FocusManager'

export interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

export interface OpenTabs {
  urls: string[]
  activeIndex: number
}

const IDLE_FOCUS: FocusPersisted = {
  phase: 'idle',
  endsAt: null,
  workspaceId: null,
  allowlist: [],
  paused: false,
  pausedRemainingMs: 0,
  startedAt: null
}

interface AppSettings {
  windowBounds: WindowBounds
  windowMaximized: boolean
  // Open tabs are remembered per workspace so each reopens with its own tabs.
  openTabsByWorkspace: Record<string, OpenTabs>
  // Focus session, persisted so a crash/restart resumes it.
  focusState: FocusPersisted
  // Per-origin zoom level (Chromium zoom level, not factor), so a site reopens
  // at the size you left it.
  zoomByOrigin: Record<string, number>
  // Sidebar visibility preferences (persist across restarts).
  sidebars: { left: boolean; right: boolean }
}

const defaults: AppSettings = {
  windowBounds: { width: 1200, height: 800 },
  windowMaximized: false,
  openTabsByWorkspace: {},
  focusState: IDLE_FOCUS,
  zoomByOrigin: {},
  sidebars: { left: true, right: true }
}

// Lazily constructed: electron-store reads the userData path in its constructor,
// which is only valid after `app` is ready. First access happens in createWindow.
let store: Store<AppSettings> | null = null
function s(): Store<AppSettings> {
  if (!store) store = new Store<AppSettings>({ defaults })
  return store
}

/** Small persisted-settings facade backed by electron-store (config.json). */
export const settings = {
  getWindowBounds: (): WindowBounds => s().get('windowBounds'),
  getWindowMaximized: (): boolean => s().get('windowMaximized'),
  setWindow: (bounds: WindowBounds, maximized: boolean): void => {
    s().set('windowBounds', bounds)
    s().set('windowMaximized', maximized)
  },
  getOpenTabs: (workspaceId: string): OpenTabs =>
    s().get('openTabsByWorkspace')[workspaceId] ?? { urls: [], activeIndex: 0 },
  setOpenTabs: (workspaceId: string, tabs: OpenTabs): void => {
    const map = s().get('openTabsByWorkspace')
    map[workspaceId] = tabs
    s().set('openTabsByWorkspace', map)
  },
  getFocusState: (): FocusPersisted => s().get('focusState'),
  setFocusState: (state: FocusPersisted): void => s().set('focusState', state),
  getZoom: (origin: string): number => s().get('zoomByOrigin')[origin] ?? 0,
  setZoom: (origin: string, level: number): void => {
    const map = s().get('zoomByOrigin')
    if (level === 0) delete map[origin]
    else map[origin] = level
    s().set('zoomByOrigin', map)
  },
  getSidebars: (): { left: boolean; right: boolean } => s().get('sidebars'),
  setSidebars: (sidebars: { left: boolean; right: boolean }): void => s().set('sidebars', sidebars)
}
