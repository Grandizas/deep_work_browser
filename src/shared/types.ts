// Types shared between the main process (authoritative) and the chrome renderer
// (a dumb mirror). Main pushes `BrowserState` via `state:update`; the renderer
// sends `CommandMessage`s back via the `cmd` channel.

/** Mirrored state of a single tab. */
export interface TabState {
  id: string
  url: string
  title: string
  favicon: string | null
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

/**
 * The authoritative browser state owned by the main process. The renderer never
 * mutates this — it only reflects whatever main last pushed.
 */
export interface BrowserState {
  tabs: TabState[]
  activeTabId: string | null
  /**
   * Monotonic counter bumped whenever main wants the renderer to focus the URL
   * bar (e.g. Ctrl+L, new tab). Carried on state so the preload bridge stays at
   * exactly two methods — the renderer watches it and focuses on change.
   */
  focusUrlBarSeq: number
}

/** Commands the chrome renderer is allowed to send to main. Grows per phase. */
export type Command =
  | 'ui:ready'
  | 'tab:new'
  | 'tab:close'
  | 'tab:activate'
  | 'tab:navigate'
  | 'tab:back'
  | 'tab:forward'
  | 'tab:reload'

/** Envelope for every renderer → main command. */
export interface CommandMessage {
  cmd: Command
  payload?: unknown
}

/** IPC channel names. Single command channel in, single state channel out. */
export const IPC = {
  command: 'cmd',
  stateUpdate: 'state:update'
} as const
