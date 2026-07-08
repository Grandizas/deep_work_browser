import { app, BaseWindow, WebContentsView, ipcMain, Menu, type Rectangle } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC, type BrowserState, type CommandMessage } from '../shared/types'
import { WorkspaceView } from './WorkspaceView'
import { installAppMenu, type MenuActions } from './menu'
import { settings } from './settings'
import {
  initHistory,
  logVisit,
  closeHistory,
  logSession,
  getNote,
  setNote,
  hasNote,
  countNotes,
  queryHistory,
  focusedMinutesToday
} from './history'
import { originOf } from '../shared/url'
import { initAdblock } from './adblock'
import { workspaces } from './workspaces'
import { roles } from './roles'
import { focus } from './FocusManager'
import { computePaletteResults } from './palette'
import type {
  WorkspaceSummary,
  RolesConfig,
  PaletteResult,
  ResumeInfo,
  HistoryEntry
} from '../shared/types'

const ROLE_KEYS: readonly (keyof RolesConfig)[] = ['essential', 'reference', 'distractions']

/** Run `fn` after `ms` of quiet, resetting the timer on each call. */
function debounce(fn: () => void, ms: number): () => void {
  let timer: NodeJS.Timeout | undefined
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

// Flow 3-column layout geometry. The chrome renderer fills the whole window and
// draws the left/right sidebars, top bar, and floating tab bar; the active tab's
// WebContentsView is inset into the center as a card. These px values MIRROR the
// renderer's CSS (App.vue), so the card lines up exactly with its rendered hole.
const FLOW_LEFT = 260 // left sidebar width
const FLOW_RIGHT = 308 // right sidebar width
const FLOW_TOPBAR = 54 // nav / address bar row
const FLOW_TABBAR = 52 // floating tab-bar strip (incl. its top gap)
const FLOW_PAD = 16 // padding around the content card
const SHELF_HEIGHT = 48 // download shelf row (center column)
const PROMPT_HEIGHT = 48 // permission prompt row
const BOOKMARKS_HEIGHT = 36 // pinned-sites row
const FIND_HEIGHT = 44 // find-in-page row

// The menu is global; it acts on whichever window is currently active. With a
// single window this is just that window's actions.
let activeActions: MenuActions | null = null

function createWindow(): void {
  const bounds = settings.getWindowBounds()
  const mainWindow = new BaseWindow({
    width: bounds.width,
    height: bounds.height,
    // Only restore position if we have one saved; otherwise let the OS center it.
    ...(bounds.x !== undefined && bounds.y !== undefined ? { x: bounds.x, y: bounds.y } : {}),
    show: false,
    title: 'Forge',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {})
  })
  if (settings.getWindowMaximized()) mainWindow.maximize()

  // Chrome UI: the Vue renderer strip pinned to the top of the window. It talks
  // to main through the preload bridge, so it gets context isolation and no node.
  const chromeView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Let the ambient-sound AudioContext start without a click — the palette
      // command that starts it is a gesture, but the play happens after an IPC
      // round-trip, so Chromium's autoplay gate would otherwise block it.
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  mainWindow.contentView.addChildView(chromeView)

  // One live WorkspaceView per visited workspace; switching hides one and shows
  // another (views stay alive). The active workspace is the one whose tabs,
  // downloads, and permission prompts drive the chrome UI.
  const workspaceViews = new Map<string, WorkspaceView>()
  let activeId = workspaces.getActiveId()
  const activeView = (): WorkspaceView | undefined => workspaceViews.get(activeId)

  // Start on the workspace picker; no WorkspaceView exists until one is chosen.
  // But if the last session left tabs open, offer to resume it first instead.
  const hasResumableSession = settings.getOpenTabs(activeId).urls.length > 0
  let showResume = hasResumableSession
  let showPicker = !hasResumableSession
  // Full-window settings screen (hides the active tabs while open).
  let showSettings = false
  // Full-window focus-complete / break celebration screen.
  let showCompletion = false
  // Ctrl+K command palette overlay (full-window, hides tabs while open).
  let showPalette = false
  let paletteResults: PaletteResult[] = []
  // Website-notes side panel — edits the active tab's origin (computed per push).
  let showNotes = false
  // Ambient sound: the current sound id (null = silence) and the last non-null
  // choice, so a focus session can auto-resume the sound you last picked.
  let ambientSound: string | null = null
  let lastAmbientSound: string | null = null
  // Last-pushed ambient-duck state, so a background workspace's audio change can
  // detect a flip and push even though it doesn't otherwise re-render the chrome.
  let lastDucked = false
  // Find-in-page: a chrome-strip row (like the download shelf). findText is the
  // last query, so find:next can step without the renderer resending it.
  let showFind = false
  let findText = ''
  let findResult = { current: 0, total: 0 }
  // Full-window searchable History screen (this workspace's history).
  let showHistory = false
  let historyResults: HistoryEntry[] = []

  // Bumped whenever main asks the renderer to focus the address bar.
  let focusUrlBarSeq = 0

  // Y offset of the content card within the center column: below the top bar and
  // tab bar, plus any optional rows (pins / find / downloads / permission).
  const centerContentTop = (): number => {
    const view = activeView()
    const hasPins = (workspaces.get(activeId)?.pinnedSites.length ?? 0) > 0
    return (
      FLOW_TOPBAR +
      FLOW_TABBAR +
      (hasPins ? BOOKMARKS_HEIGHT : 0) +
      (showFind ? FIND_HEIGHT : 0) +
      (view && view.downloads.getState().length > 0 ? SHELF_HEIGHT : 0) +
      (view && view.permissions.current() ? PROMPT_HEIGHT : 0)
    )
  }

  // The inset region the active tab occupies: the center content card, between
  // the two sidebars and below the top bar / tab bar, padded on all sides.
  const contentRegion = (): Rectangle => {
    const { width, height } = mainWindow.getContentBounds()
    const x = FLOW_LEFT + FLOW_PAD
    const y = centerContentTop() + FLOW_PAD
    return {
      x,
      y,
      width: Math.max(0, width - FLOW_LEFT - FLOW_RIGHT - FLOW_PAD * 2),
      height: Math.max(0, height - y - FLOW_PAD)
    }
  }

  // Summarize the last session for the startup resume card: which workspace, how
  // many tabs, note count, and any paused/running focus timer to pick back up.
  const resumeInfo = (): ResumeInfo | null => {
    const ws = workspaces.get(activeId)
    const saved = settings.getOpenTabs(activeId)
    if (!ws || saved.urls.length === 0) return null
    const snap = focus.snapshot()
    return {
      workspace: { id: ws.id, name: ws.name, emoji: ws.emoji, themeColor: ws.themeColor },
      tabCount: saved.urls.length,
      notesCount: countNotes(),
      focus: snap.state === 'idle' ? null : snap
    }
  }

  // Open-tab count for every workspace (visited ones from their live views,
  // others from persisted state) — powers the sidebar's per-workspace counts.
  const workspaceTabCounts = (): Record<string, number> => {
    const counts: Record<string, number> = {}
    for (const w of workspaces.getAll()) {
      const view = workspaceViews.get(w.id)
      counts[w.id] = view
        ? view.tabs.getState().tabs.length
        : settings.getOpenTabs(w.id).urls.length
    }
    return counts
  }

  // Whether any tab in ANY workspace is playing audio — ambient ducking is a
  // global signal, so background workspaces count too.
  const anyTabAudible = (): boolean => [...workspaceViews.values()].some((v) => v.tabs.anyAudible())

  // Push the active workspace's authoritative state to the chrome renderer.
  const pushState = (): void => {
    if (chromeView.webContents.isDestroyed()) return
    const view = activeView()
    const tabState = view ? view.tabs.getState() : { tabs: [], activeTabId: null }
    const activeUrl = tabState.tabs.find((t) => t.id === tabState.activeTabId)?.url ?? ''
    const activeOrigin = originOf(activeUrl)
    const state: BrowserState = {
      tabs: tabState.tabs,
      activeTabId: tabState.activeTabId,
      downloads: view ? view.downloads.getState() : [],
      permissionRequest: view ? view.permissions.current() : null,
      workspaces: workspaceSummaries(),
      activeWorkspaceId: activeId,
      workspaceTabCounts: workspaceTabCounts(),
      dailyFocusMinutes: focusedMinutesToday(activeId),
      pinnedSites: workspaces.get(activeId)?.pinnedSites ?? [],
      showPicker,
      showResume,
      resume: showResume ? resumeInfo() : null,
      showSettings,
      roles: roles.getGlobal(),
      focus: focus.snapshot(),
      showCompletion,
      showPalette,
      paletteResults,
      showNotes,
      // The right sidebar always edits the active tab's origin, so push it every
      // time. noteBody is only the initial content — the renderer resets its
      // textarea when noteOrigin changes, so same-origin pushes never clobber it.
      noteOrigin: activeOrigin,
      noteBody: getNote(activeOrigin),
      activeHasNote: hasNote(activeOrigin),
      ambientSound,
      // Duck while any tab in any workspace is playing audio.
      ambientDucked: (lastDucked = anyTabAudible()),
      showFind,
      findResult,
      // Active tab's zoom as a percentage (100 = default) for the toolbar readout.
      zoomPercent: Math.round(Math.pow(1.2, view ? view.tabs.getZoom() : 0) * 100),
      showHistory,
      historyResults,
      focusUrlBarSeq
    }
    chromeView.webContents.send(IPC.stateUpdate, state)
  }

  // Persist a specific workspace's tabs to its own key — never assume the change
  // came from the active workspace (a background workspace can emit changes too,
  // e.g. a page calling window.open).
  const persistTabsFor = (id: string): void => {
    if (mainWindow.isDestroyed()) return
    const view = workspaceViews.get(id)
    if (!view) return
    const state = view.tabs.getState()
    const urls = state.tabs.map((t) => t.url)
    const activeIndex = Math.max(
      0,
      state.tabs.findIndex((t) => t.id === state.activeTabId)
    )
    settings.setOpenTabs(id, { urls, activeIndex })
  }

  // Restore a workspace's persisted tabs, or open a default first tab.
  const restoreTabs = (view: WorkspaceView, workspaceId: string): void => {
    const saved = settings.getOpenTabs(workspaceId)
    if (saved.urls.length > 0) {
      // Lazy restore: only the active tab loads now; the rest load on activation.
      view.tabs.restore(saved.urls, saved.activeIndex)
    } else {
      view.tabs.create('https://example.com')
    }
  }

  // Get (or lazily create + restore) the WorkspaceView for a workspace id.
  const ensureView = (id: string): WorkspaceView => {
    let view = workspaceViews.get(id)
    if (!view) {
      const ws = workspaces.get(id) ?? workspaces.getActive()
      // Tag each workspace's navigations with its own id in history.
      const onNavigate = (info: { url: string; title: string }): void =>
        logVisit(info.url, info.title, ws.id)
      // Each workspace persists its OWN tabs (debounced). Only the active one
      // drives the chrome UI, so background changes don't re-render it.
      const persist = debounce(() => persistTabsFor(id), 800)
      const onChange = (): void => {
        if (id === activeId) {
          pushState()
          layoutViews()
        } else if (anyTabAudible() !== lastDucked) {
          // A background workspace's tab started/stopped audio and that flips
          // ambient ducking — push so the renderer ducks/unducks in real time.
          pushState()
        }
        persist()
      }
      // Find-in-page results from THIS workspace only matter while it's active.
      const onFound = (current: number, total: number): void => {
        if (id === activeId) {
          findResult = { current, total }
          pushState()
        }
      }
      view = new WorkspaceView(
        mainWindow,
        ws,
        onChange,
        contentRegion(),
        onNavigate,
        onFound,
        (origin) => settings.getZoom(origin)
      )
      workspaceViews.set(id, view)
      restoreTabs(view, id)
    }
    return view
  }

  // Persist window size/position, but only the un-maximized ("normal") bounds so
  // a restore returns to a usable size. The maximized flag is recorded separately.
  const persistWindow = (): void => {
    if (mainWindow.isDestroyed()) return
    if (mainWindow.isMaximized()) {
      settings.setWindow(settings.getWindowBounds(), true)
    } else {
      const b = mainWindow.getBounds()
      settings.setWindow({ width: b.width, height: b.height, x: b.x, y: b.y }, false)
    }
  }
  const schedulePersistWindow = debounce(persistWindow, 500)

  const focusUrlBar = (): void => {
    focusUrlBarSeq++
    chromeView.webContents.focus()
    pushState()
  }

  const workspaceSummaries = (): WorkspaceSummary[] =>
    workspaces.getAll().map(({ id, name, emoji, themeColor }) => ({ id, name, emoji, themeColor }))

  // Native dropdown for the workspace switcher — a native popup isn't clipped by
  // the tab WebContentsView the way a chrome-view dropdown would be.
  const showWorkspaceMenu = (): void => {
    const menu = Menu.buildFromTemplate(
      workspaces.getAll().map((w) => ({
        label: `${w.emoji}  ${w.name}`,
        type: 'checkbox' as const,
        checked: w.id === activeId,
        click: () => switchWorkspace(w.id)
      }))
    )
    menu.popup({ window: mainWindow })
  }

  // Enter a workspace from the startup picker: create/show it and drop the
  // full-window picker down to the normal chrome strip.
  const startWorkspace = (id: string): void => {
    activeId = id
    workspaces.setActiveId(id)
    showPicker = false
    showResume = false
    ensureView(id)
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Resume card: "Continue" enters the last workspace (lazily restoring its tabs
  // via ensureView); "Choose a different workspace" falls through to the picker.
  const resumeSession = (): void => startWorkspace(activeId)
  const dismissResume = (): void => {
    if (!showResume) return
    showResume = false
    showPicker = true
    pushState()
  }

  // Switch workspaces: flush + hide the current one's views, then show the target
  // (created and restored on first visit). Both stay alive across the switch.
  const switchWorkspace = (id: string): void => {
    if (id === activeId) return
    if (showFind) closeFind() // find highlights/results belong to the old tab
    persistTabsFor(activeId)
    activeView()?.hide()

    activeId = id
    workspaces.setActiveId(id)
    ensureView(id)
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Start-focus presets (minutes). A session's allowlist is the current
  // workspace's Essential + Reference sites, snapshotted at start.
  const FOCUS_PRESETS = [25, 50, 90]
  const startFocusSession = (minutes: number): void => {
    const eff = roles.getEffective(activeId)
    focus.startFocus(activeId, minutes * 60_000, [...eff.essential, ...eff.reference])
    // Auto-resume the last-chosen ambient sound when a session begins.
    if (!ambientSound && lastAmbientSound) setAmbient(lastAmbientSound)
  }
  // Palette `new <workspace> session`: switch into the workspace first, then
  // start a focus session there (the allowlist is snapshotted from the target).
  const startWorkspaceSession = (id: string, minutes: number): void => {
    switchWorkspace(id)
    startFocusSession(minutes)
  }
  const showFocusMenu = (): void => {
    const menu = Menu.buildFromTemplate(
      FOCUS_PRESETS.map((min) => ({
        label: `${min} minutes`,
        click: () => startFocusSession(min)
      }))
    )
    menu.popup({ window: mainWindow })
  }

  // Menu on the active timer: pause/resume + end the session.
  const showFocusControlMenu = (): void => {
    const paused = focus.snapshot().paused
    const menu = Menu.buildFromTemplate([
      paused
        ? { label: 'Resume', click: () => focus.resume() }
        : { label: 'Pause', click: () => focus.pause() },
      { type: 'separator' },
      { label: 'End session', click: () => focus.end() }
    ])
    menu.popup({ window: mainWindow })
  }

  // Pin / unpin a site in the active workspace's bookmarks row.
  const pinSite = (url: string): void => {
    const ws = workspaces.get(activeId)
    if (!ws || !url || url === 'about:blank' || ws.pinnedSites.includes(url)) return
    workspaces.update(activeId, { pinnedSites: [...ws.pinnedSites, url] })
    layoutViews()
    pushState()
  }
  const unpinSite = (url: string): void => {
    const ws = workspaces.get(activeId)
    if (!ws) return
    workspaces.update(activeId, { pinnedSites: ws.pinnedSites.filter((u) => u !== url) })
    layoutViews()
    pushState()
  }

  // Settings screen: hide the active tabs and take the chrome view full-window.
  const openSettings = (): void => {
    if (showPicker || showSettings) return
    showSettings = true
    activeView()?.hide()
    layoutViews()
    pushState()
  }
  const closeSettings = (): void => {
    if (!showSettings) return
    showSettings = false
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Add / remove a site pattern in a global role list.
  const editRole = (role: keyof RolesConfig, pattern: string, add: boolean): void => {
    const pat = pattern.trim().toLowerCase()
    if (!pat) return
    const g = roles.getGlobal()
    const next = add
      ? g[role].includes(pat)
        ? g[role]
        : [...g[role], pat]
      : g[role].filter((p) => p !== pat)
    roles.setGlobal({ ...g, [role]: next })
    pushState()
  }

  // User-initiated new tab: open blank and drop the cursor in the address bar.
  const newTab = (): void => {
    activeView()?.tabs.create()
    focusUrlBar()
  }

  // Keep the chrome strip and the active workspace's tab sized to the window.
  // The picker and settings screens fill the whole window (tabs are hidden).
  // The chrome renderer always fills the window (it draws the whole Flow frame);
  // the active tab is inset into the center content card. Full-window screens
  // (picker, settings, palette, history, resume, completion) hide the tab view.
  const layoutViews = (): void => {
    const { width, height } = mainWindow.getContentBounds()
    chromeView.setBounds({ x: 0, y: 0, width, height })
    const modal =
      showResume || showPicker || showSettings || showCompletion || showPalette || showHistory
    if (modal) return
    activeView()?.tabs.layout(contentRegion())
  }
  layoutViews()
  mainWindow.on('resize', layoutViews)
  mainWindow.on('resize', schedulePersistWindow)
  mainWindow.on('move', schedulePersistWindow)
  mainWindow.on('maximize', persistWindow)
  mainWindow.on('unmaximize', persistWindow)

  // The focus timer lives in main; reflect its phase changes to this window.
  // When a break elapses back to idle, dismiss the completion screen too.
  focus.onChange = () => {
    if (showCompletion && focus.snapshot().state === 'idle') {
      showCompletion = false
      layoutViews()
      activeView()?.show(contentRegion())
    }
    settings.setFocusState(focus.serialize())
    pushState()
  }
  // A finished focus session shows the full-window 🎉 celebration (tabs hidden).
  focus.onComplete = () => {
    activeView()?.hide()
    showCompletion = true
    layoutViews()
    pushState()
  }
  const closeCompletion = (): void => {
    if (!showCompletion) return
    showCompletion = false
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Command palette (Ctrl+K): full-window overlay, tabs hidden while open.
  const openPalette = (): void => {
    if (showPalette || showPicker || showSettings || showCompletion || showHistory) return
    showPalette = true
    activeView()?.hide()
    chromeView.webContents.focus()
    layoutViews()
    pushState()
  }
  const closePalette = (): void => {
    if (!showPalette) return
    showPalette = false
    paletteResults = []
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }
  const togglePalette = (): void => {
    if (showPalette) closePalette()
    else openPalette()
  }
  const runPaletteQuery = (query: string): void => {
    const view = activeView()
    const tabsState = view ? view.tabs.getState() : { tabs: [], activeTabId: null }
    paletteResults = computePaletteResults(query, {
      tabs: tabsState.tabs,
      activeTabId: tabsState.activeTabId,
      workspaces: workspaceSummaries(),
      activeWorkspaceId: activeId,
      roles: roles.getEffective(activeId)
    })
    pushState()
  }

  // Website notes (Ctrl+Shift+N): a live side panel — chrome fills the window and
  // the tab view shrinks to make room, so the page stays visible while you write.
  const openNotes = (): void => {
    if (showNotes || showPicker || showSettings || showCompletion || showPalette) return
    showNotes = true
    layoutViews()
    chromeView.webContents.focus()
    pushState()
  }
  const closeNotes = (): void => {
    if (!showNotes) return
    showNotes = false
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }
  const toggleNotes = (): void => {
    if (showNotes) closeNotes()
    else openNotes()
  }
  // Autosave from the panel. The origin comes from the renderer so a tab switch
  // mid-edit can't misfile the note; an empty body deletes it (setNote).
  const saveNote = (origin: string, body: string): void => {
    if (!origin) return
    setNote(origin, body)
    pushState()
  }

  // Ambient sound: main owns which sound is playing; the chrome renderer
  // synthesizes it via Web Audio in response to the pushed state.
  const setAmbient = (sound: string | null): void => {
    ambientSound = sound
    if (sound) lastAmbientSound = sound
    pushState()
  }

  // Find-in-page (Ctrl+F): a chrome-strip row that drives the active tab's
  // findInPage. The row grows chromeHeight, so the tab view shifts down for it.
  const openFind = (): void => {
    showFind = true
    findResult = { current: 0, total: 0 }
    layoutViews()
    // Focus the chrome renderer so the find field (which autofocuses on mount)
    // gets keystrokes even if a tab page currently has focus.
    chromeView.webContents.focus()
    pushState()
  }
  const runFind = (text: string): void => {
    findText = text
    if (!text) findResult = { current: 0, total: 0 }
    activeView()?.tabs.find(text)
    pushState()
  }
  const findNext = (forward: boolean): void => {
    if (!findText) return
    activeView()?.tabs.find(findText, { forward, findNext: true })
  }
  const closeFind = (): void => {
    if (!showFind) return
    showFind = false
    findText = ''
    findResult = { current: 0, total: 0 }
    activeView()?.tabs.stopFind()
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Per-site zoom (Chromium zoom levels; factor = 1.2^level). The active tab's
  // origin remembers its level, re-applied on navigation (see TabManager).
  const ZOOM_MIN = -3
  const ZOOM_MAX = 5
  const applyZoom = (delta: number | 'reset'): void => {
    const view = activeView()
    if (!view) return
    const level =
      delta === 'reset' ? 0 : Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, view.tabs.getZoom() + delta))
    view.tabs.setZoom(level)
    const url = view.tabs
      .getState()
      .tabs.find((t) => t.id === view.tabs.getState().activeTabId)?.url
    const origin = originOf(url ?? '')
    if (origin) settings.setZoom(origin, level)
    pushState()
  }

  // Full-window searchable History screen (this workspace only).
  const openHistory = (): void => {
    if (showHistory || showPicker || showResume || showSettings || showCompletion || showPalette)
      return
    showHistory = true
    historyResults = queryHistory(activeId, '', 200)
    activeView()?.hide()
    chromeView.webContents.focus()
    layoutViews()
    pushState()
  }
  const runHistoryQuery = (query: string): void => {
    historyResults = queryHistory(activeId, query.trim(), 200)
    pushState()
  }
  const closeHistory = (): void => {
    if (!showHistory) return
    showHistory = false
    historyResults = []
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Commands: renderer → main. Reject anything not sent by our chrome view —
  // a sandboxed tab page must never be able to drive the browser.
  const onCommand = (event: Electron.IpcMainEvent, message: CommandMessage): void => {
    if (event.sender !== chromeView.webContents) return
    if (!message || typeof message.cmd !== 'string') return
    const payload = (message.payload ?? {}) as {
      id?: string
      url?: string
      granted?: boolean
      role?: string
      pattern?: string
      minutes?: number
      query?: string
      origin?: string
      body?: string
      sound?: string | null
      text?: string
      forward?: boolean
    }

    switch (message.cmd) {
      case 'ui:ready':
        pushState()
        break
      case 'tab:new':
        newTab()
        break
      case 'tab:close':
        if (typeof payload.id === 'string') activeView()?.tabs.close(payload.id)
        break
      case 'tab:activate':
        if (typeof payload.id === 'string') activeView()?.tabs.activate(payload.id)
        break
      case 'tab:navigate':
        if (typeof payload.url === 'string') activeView()?.tabs.navigate(payload.url)
        break
      case 'tab:back':
        activeView()?.tabs.back()
        break
      case 'tab:forward':
        activeView()?.tabs.forward()
        break
      case 'tab:reload':
        activeView()?.tabs.reload()
        break
      case 'download:open':
        if (typeof payload.id === 'string') activeView()?.downloads.open(payload.id)
        break
      case 'download:cancel':
        if (typeof payload.id === 'string') activeView()?.downloads.cancel(payload.id)
        break
      case 'downloads:clear':
        activeView()?.downloads.clearFinished()
        break
      case 'permission:resolve':
        if (typeof payload.id === 'string' && typeof payload.granted === 'boolean') {
          activeView()?.permissions.resolve(payload.id, payload.granted)
        }
        break
      case 'workspace:menu':
        showWorkspaceMenu()
        break
      case 'focus:menu':
        showFocusMenu()
        break
      case 'focus:control':
        showFocusControlMenu()
        break
      case 'focus:dismiss':
        closeCompletion()
        break
      case 'palette:close':
        closePalette()
        break
      case 'palette:open':
        openPalette()
        break
      case 'palette:query':
        if (typeof payload.query === 'string') runPaletteQuery(payload.query)
        break
      case 'notes:toggle':
        toggleNotes()
        break
      case 'notes:close':
        closeNotes()
        break
      case 'notes:save':
        if (typeof payload.origin === 'string' && typeof payload.body === 'string') {
          saveNote(payload.origin, payload.body)
        }
        break
      case 'focus:start':
        if (typeof payload.minutes === 'number') startFocusSession(payload.minutes)
        break
      case 'workspace:switch':
        if (typeof payload.id === 'string') switchWorkspace(payload.id)
        break
      case 'workspace:session':
        if (typeof payload.id === 'string' && typeof payload.minutes === 'number') {
          startWorkspaceSession(payload.id, payload.minutes)
        }
        break
      case 'workspace:start':
        if (typeof payload.id === 'string') startWorkspace(payload.id)
        break
      case 'session:resume':
        resumeSession()
        break
      case 'session:dismiss':
        dismissResume()
        break
      case 'ambient:set':
        // sound is a string id or null (silence); ignore anything else.
        if (payload.sound === null || typeof payload.sound === 'string') {
          setAmbient(payload.sound)
        }
        break
      case 'find:open':
        openFind()
        break
      case 'find:query':
        if (typeof payload.text === 'string') runFind(payload.text)
        break
      case 'find:next':
        findNext(payload.forward !== false)
        break
      case 'find:close':
        closeFind()
        break
      case 'zoom:in':
        applyZoom(1)
        break
      case 'zoom:out':
        applyZoom(-1)
        break
      case 'zoom:reset':
        applyZoom('reset')
        break
      case 'history:open':
        openHistory()
        break
      case 'history:query':
        if (typeof payload.query === 'string') runHistoryQuery(payload.query)
        break
      case 'history:close':
        closeHistory()
        break
      case 'workspace:pin':
        if (typeof payload.url === 'string') pinSite(payload.url)
        break
      case 'workspace:unpin':
        if (typeof payload.url === 'string') unpinSite(payload.url)
        break
      case 'settings:open':
        openSettings()
        break
      case 'settings:close':
        closeSettings()
        break
      case 'roles:add':
      case 'roles:remove':
        if (
          typeof payload.role === 'string' &&
          typeof payload.pattern === 'string' &&
          (ROLE_KEYS as string[]).includes(payload.role)
        ) {
          editRole(payload.role as keyof RolesConfig, payload.pattern, message.cmd === 'roles:add')
        }
        break
      default:
        console.warn('[main] unknown command:', message.cmd)
    }
  }
  ipcMain.on(IPC.command, onCommand)

  // Route the global menu's accelerators at this window while it's alive.
  activeActions = {
    newTab,
    closeTab: () => activeView()?.tabs.closeActive(),
    focusUrlBar,
    nextTab: () => activeView()?.tabs.activateAdjacent(1),
    prevTab: () => activeView()?.tabs.activateAdjacent(-1),
    reload: () => activeView()?.tabs.reload(),
    togglePalette,
    toggleNotes,
    openFind,
    zoomIn: () => applyZoom(1),
    zoomOut: () => applyZoom(-1),
    zoomReset: () => applyZoom('reset'),
    openHistory
  }

  // Flush persisted state while the window and tabs are still alive ('close'
  // fires before 'closed'). Flush every visited workspace, not just the active
  // one, so pending debounced saves for background workspaces aren't lost.
  mainWindow.on('close', () => {
    persistWindow()
    for (const id of workspaceViews.keys()) persistTabsFor(id)
  })

  // Tear down per-window resources: BaseWindow doesn't dispose child views, and
  // ipcMain listeners accumulate across window re-creations (macOS activate).
  mainWindow.on('closed', () => {
    ipcMain.removeListener(IPC.command, onCommand)
    for (const view of workspaceViews.values()) view.destroy()
    workspaceViews.clear()
    if (!chromeView.webContents.isDestroyed()) chromeView.webContents.close()
    if (activeActions?.newTab === newTab) activeActions = null
    focus.onChange = null
    focus.onComplete = null
  })

  chromeView.webContents.once('did-finish-load', () => {
    mainWindow.show()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    chromeView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    chromeView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }
  // Start on the workspace picker (chrome view fills the window). A workspace is
  // created and shown only once the user picks one via 'workspace:start'.
  layoutViews()
  pushState()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.forge.browser')

  initHistory()
  initAdblock()
  workspaces.init()
  roles.init()
  // Log every finished focus session to SQLite (app-level, not per-window).
  focus.onSessionEnd = (s) => logSession(s.workspaceId, s.startedAt, s.endedAt, s.completed)
  // Resume a focus session that was running when the app last closed/crashed,
  // then re-persist: a session that elapsed offline is logged once and reset to
  // idle here, so it isn't re-logged on the next launch.
  focus.restore(settings.getFocusState())
  settings.setFocusState(focus.serialize())
  installAppMenu(() => activeActions)

  createWindow()

  // Auto-update: check GitHub releases and notify when an update is downloaded.
  // Only in packaged builds — in dev there's no update feed to hit.
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[updater] check failed:', err)
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BaseWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeHistory()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
