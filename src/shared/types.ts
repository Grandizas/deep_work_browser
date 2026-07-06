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
 * A workspace: an isolated browsing context with its own session partition
 * (cookies/logins), tabs, and pinned sites. Persisted in electron-store.
 */
export interface Workspace {
  id: string
  name: string
  emoji: string
  themeColor: string
  /** Electron session partition, e.g. `persist:ws-coding` — isolates logins. */
  partition: string
  /** Tab ids currently belonging to this workspace. */
  tabIds: string[]
  /** Pinned site URLs shown in the workspace's bookmarks row. */
  pinnedSites: string[]
}

/** The renderer-facing subset of a Workspace, used to render the switcher. */
export interface WorkspaceSummary {
  id: string
  name: string
  emoji: string
  themeColor: string
}

/** A pending permission request awaiting the user's allow/deny via chrome UI. */
export interface PermissionRequest {
  id: string
  origin: string
  /** Human-facing capability names, e.g. ['microphone'], ['camera', 'microphone'], ['notifications']. */
  types: string[]
}

/** A download's mirrored progress/state. */
export interface DownloadState {
  id: string
  filename: string
  url: string
  receivedBytes: number
  totalBytes: number
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted'
  savePath: string
}

/**
 * The authoritative browser state owned by the main process. The renderer never
 * mutates this — it only reflects whatever main last pushed.
 */
export interface BrowserState {
  tabs: TabState[]
  activeTabId: string | null
  downloads: DownloadState[]
  /** The current permission prompt to surface, or null. One at a time. */
  permissionRequest: PermissionRequest | null
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
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
  | 'download:open'
  | 'download:cancel'
  | 'downloads:clear'
  | 'permission:resolve'
  | 'workspace:menu'

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
