import Store from 'electron-store'

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

interface AppSettings {
  windowBounds: WindowBounds
  windowMaximized: boolean
  openTabs: OpenTabs
}

const defaults: AppSettings = {
  windowBounds: { width: 1200, height: 800 },
  windowMaximized: false,
  openTabs: { urls: [], activeIndex: 0 }
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
  getOpenTabs: (): OpenTabs => s().get('openTabs'),
  setOpenTabs: (tabs: OpenTabs): void => s().set('openTabs', tabs)
}
