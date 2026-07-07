import { app, BaseWindow, WebContentsView, ipcMain, Menu, type Rectangle } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC, type BrowserState, type CommandMessage } from '../shared/types'
import { WorkspaceView } from './WorkspaceView'
import { installAppMenu, type MenuActions } from './menu'
import { settings } from './settings'
import { initHistory, logVisit, closeHistory, logSession } from './history'
import { workspaces } from './workspaces'
import { roles } from './roles'
import { focus } from './FocusManager'
import type { WorkspaceSummary, RolesConfig } from '../shared/types'

const ROLE_KEYS: readonly (keyof RolesConfig)[] = ['essential', 'reference', 'distractions']

/** Run `fn` after `ms` of quiet, resetting the timer on each call. */
function debounce(fn: () => void, ms: number): () => void {
  let timer: NodeJS.Timeout | undefined
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

// Height of the chrome UI strip (tab bar + toolbar). A download shelf and a
// permission prompt each add a row below it, so total chrome height is dynamic.
const BASE_CHROME_HEIGHT = 88
const SHELF_HEIGHT = 48
const PROMPT_HEIGHT = 48
const BOOKMARKS_HEIGHT = 36

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
      sandbox: false
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
  let showPicker = true
  // Full-window settings screen (hides the active tabs while open).
  let showSettings = false
  // Full-window focus-complete / break celebration screen.
  let showCompletion = false

  // Bumped whenever main asks the renderer to focus the address bar.
  let focusUrlBarSeq = 0

  // Chrome height grows by a row for the active workspace's download shelf and
  // permission prompt. Tolerant of no active view yet (returns the base height).
  const chromeHeight = (): number => {
    const view = activeView()
    if (!view) return BASE_CHROME_HEIGHT
    const hasPins = (workspaces.get(activeId)?.pinnedSites.length ?? 0) > 0
    return (
      BASE_CHROME_HEIGHT +
      (hasPins ? BOOKMARKS_HEIGHT : 0) +
      (view.downloads.getState().length > 0 ? SHELF_HEIGHT : 0) +
      (view.permissions.current() ? PROMPT_HEIGHT : 0)
    )
  }

  // Region tabs occupy: everything below the chrome strip.
  const contentRegion = (): Rectangle => {
    const { width, height } = mainWindow.getContentBounds()
    const top = chromeHeight()
    return { x: 0, y: top, width, height: height - top }
  }

  // Push the active workspace's authoritative state to the chrome renderer.
  const pushState = (): void => {
    if (chromeView.webContents.isDestroyed()) return
    const view = activeView()
    const state: BrowserState = {
      tabs: view ? view.tabs.getState().tabs : [],
      activeTabId: view ? view.tabs.getState().activeTabId : null,
      downloads: view ? view.downloads.getState() : [],
      permissionRequest: view ? view.permissions.current() : null,
      workspaces: workspaceSummaries(),
      activeWorkspaceId: activeId,
      pinnedSites: workspaces.get(activeId)?.pinnedSites ?? [],
      showPicker,
      showSettings,
      roles: roles.getGlobal(),
      focus: focus.snapshot(),
      showCompletion,
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
      // Restore without blocking — the user explicitly had these open.
      const ids = saved.urls.map((url) => view.tabs.create(url, false))
      const target = ids[saved.activeIndex] ?? ids[0]
      if (target) view.tabs.activate(target)
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
        }
        persist()
      }
      view = new WorkspaceView(mainWindow, ws, onChange, contentRegion(), onNavigate)
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
    ensureView(id)
    layoutViews()
    activeView()?.show(contentRegion())
    pushState()
  }

  // Switch workspaces: flush + hide the current one's views, then show the target
  // (created and restored on first visit). Both stay alive across the switch.
  const switchWorkspace = (id: string): void => {
    if (id === activeId) return
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
  const layoutViews = (): void => {
    const { width, height } = mainWindow.getContentBounds()
    if (showPicker || showSettings || showCompletion) {
      chromeView.setBounds({ x: 0, y: 0, width, height })
      return
    }
    chromeView.setBounds({ x: 0, y: 0, width, height: chromeHeight() })
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
      case 'workspace:start':
        if (typeof payload.id === 'string') startWorkspace(payload.id)
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
    reload: () => activeView()?.tabs.reload()
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
  electronApp.setAppUserModelId('com.electron')

  initHistory()
  workspaces.init()
  roles.init()
  // Log every finished focus session to SQLite (app-level, not per-window).
  focus.onSessionEnd = (s) => logSession(s.workspaceId, s.startedAt, s.endedAt, s.completed)
  // Resume a focus session that was running when the app last closed/crashed.
  focus.restore(settings.getFocusState())
  installAppMenu(() => activeActions)

  createWindow()

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
