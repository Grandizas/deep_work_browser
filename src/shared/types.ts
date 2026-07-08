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

/** Daily dashboard stats, computed in main from SQLite for the new-tab page. */
export interface DashboardStats {
  sessionsToday: number
  focusedMinutesToday: number
  /** Consecutive local days (up to today) with ≥1 completed session. */
  streak: number
  topSites: { origin: string; visits: number }[]
  blockedToday: number
}

/** A command-palette result row. Selecting it dispatches `cmd` with `payload`. */
export interface PaletteResult {
  id: string
  title: string
  subtitle?: string
  icon?: string
  cmd: Command
  payload?: unknown
}

/** Focus-session phase. */
export type FocusPhase = 'idle' | 'focus' | 'break'

/**
 * Renderer-facing focus-session state. The countdown is computed in the renderer
 * from `endsAt` vs the current time, so main only pushes on phase changes (not
 * every second).
 */
export interface FocusSnapshot {
  state: FocusPhase
  endsAt: number | null
  workspaceId: string | null
  /** Paused sessions freeze the countdown; `endsAt` is null and time is `remainingMs`. */
  paused: boolean
  /** Remaining time; the renderer uses this while paused, else ticks from `endsAt`. */
  remainingMs: number
}

/**
 * Website role lists — patterns (hostnames or host+path prefixes) classifying
 * what each site is. Drives the blocking engine. Held globally with per-workspace
 * overrides.
 */
export interface RolesConfig {
  essential: string[]
  reference: string[]
  distractions: string[]
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
  /** The active workspace's pinned site URLs (its bookmarks row). */
  pinnedSites: string[]
  /** When true, show the "what are you working on?" picker instead of the browser. */
  showPicker: boolean
  /** When true, show the full-window settings (roles management) screen. */
  showSettings: boolean
  /** Global website roles, shown/edited in the settings screen. */
  roles: RolesConfig
  /** Current focus-session state (timer lives in main). */
  focus: FocusSnapshot
  /** When true, show the full-window 🎉 focus-complete / break screen. */
  showCompletion: boolean
  /** When true, show the Ctrl+K command palette overlay. */
  showPalette: boolean
  /** Ranked palette results for the current query. */
  paletteResults: PaletteResult[]
  /** When true, show the website-notes side panel (Ctrl+Shift+N). */
  showNotes: boolean
  /** Origin (host) the notes panel is editing — follows the active tab. */
  noteOrigin: string
  /** Saved note body for `noteOrigin` (the panel's initial textarea content). */
  noteBody: string
  /** Whether the active tab's origin has a saved note — drives the URL-bar dot. */
  activeHasNote: boolean
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
  | 'workspace:start'
  | 'workspace:pin'
  | 'workspace:unpin'
  | 'settings:open'
  | 'settings:close'
  | 'roles:add'
  | 'roles:remove'
  | 'focus:menu'
  | 'focus:start'
  | 'focus:control'
  | 'focus:dismiss'
  | 'workspace:switch'
  | 'workspace:session'
  | 'palette:close'
  | 'palette:query'
  | 'notes:toggle'
  | 'notes:close'
  | 'notes:save'

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
