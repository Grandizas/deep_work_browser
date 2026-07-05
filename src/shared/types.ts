// Types shared between the main process (authoritative) and the chrome renderer
// (a dumb mirror). Main pushes `BrowserState` via `state:update`; the renderer
// sends `CommandMessage`s back via the `cmd` channel.

/** Mirrored state of a single tab's web page. */
export interface TabState {
  url: string
  title: string
  isLoading: boolean
}

/**
 * The authoritative browser state owned by the main process. The renderer never
 * mutates this — it only reflects whatever main last pushed.
 */
export interface BrowserState {
  activeTab: TabState | null
}

/** Commands the chrome renderer is allowed to send to main. Grows per phase. */
export type Command = 'ui:ready'

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
