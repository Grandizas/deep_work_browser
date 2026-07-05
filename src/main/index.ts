import { app, BaseWindow, WebContentsView, ipcMain, type Rectangle } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC, type BrowserState, type CommandMessage } from '../shared/types'
import { TabManager } from './TabManager'
import { installAppMenu, type MenuActions } from './menu'
import { settings } from './settings'
import { initHistory, logVisit, closeHistory } from './history'

/** Run `fn` after `ms` of quiet, resetting the timer on each call. */
function debounce(fn: () => void, ms: number): () => void {
  let timer: NodeJS.Timeout | undefined
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

// Height of the chrome UI strip (tab bar + toolbar) along the top of the window.
const CHROME_HEIGHT = 88

// Persistent session partition for tab content. The `persist:` prefix means
// cookies, localStorage, and logins are written to disk and survive restart.
// Phase 3 replaces this single partition with one per workspace.
const TAB_PARTITION = 'persist:default'

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

  // Region tabs occupy: everything below the chrome strip.
  const contentRegion = (): Rectangle => {
    const { width, height } = mainWindow.getContentBounds()
    return { x: 0, y: CHROME_HEIGHT, width, height: height - CHROME_HEIGHT }
  }

  // Bumped whenever main asks the renderer to focus the address bar.
  let focusUrlBarSeq = 0

  // Push the authoritative state to the chrome renderer's Pinia store.
  const pushState = (): void => {
    if (chromeView.webContents.isDestroyed()) return
    const state: BrowserState = { ...tabs.getState(), focusUrlBarSeq }
    chromeView.webContents.send(IPC.stateUpdate, state)
  }

  // Every tab change both refreshes the renderer and (debounced) persists the
  // open-tab list so it can be restored next launch.
  const tabs = new TabManager(
    mainWindow,
    () => {
      pushState()
      schedulePersistTabs()
    },
    contentRegion(),
    TAB_PARTITION,
    // Log every navigation to history. workspaceId is null until Phase 3.
    (info) => logVisit(info.url, info.title, null)
  )

  const persistTabs = (): void => {
    const state = tabs.getState()
    const urls = state.tabs.map((t) => t.url)
    const activeIndex = Math.max(
      0,
      state.tabs.findIndex((t) => t.id === state.activeTabId)
    )
    settings.setOpenTabs({ urls, activeIndex })
  }
  const schedulePersistTabs = debounce(persistTabs, 800)

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

  // User-initiated new tab: open blank and drop the cursor in the address bar.
  const newTab = (): void => {
    tabs.create()
    focusUrlBar()
  }

  // Keep the chrome strip and the active tab sized to the window.
  const layoutViews = (): void => {
    const { width } = mainWindow.getContentBounds()
    chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT })
    tabs.layout(contentRegion())
  }
  layoutViews()
  mainWindow.on('resize', layoutViews)
  mainWindow.on('resize', schedulePersistWindow)
  mainWindow.on('move', schedulePersistWindow)
  mainWindow.on('maximize', persistWindow)
  mainWindow.on('unmaximize', persistWindow)

  // Commands: renderer → main. Reject anything not sent by our chrome view —
  // a sandboxed tab page must never be able to drive the browser.
  const onCommand = (event: Electron.IpcMainEvent, message: CommandMessage): void => {
    if (event.sender !== chromeView.webContents) return
    if (!message || typeof message.cmd !== 'string') return
    const payload = (message.payload ?? {}) as { id?: string; url?: string }

    switch (message.cmd) {
      case 'ui:ready':
        pushState()
        break
      case 'tab:new':
        newTab()
        break
      case 'tab:close':
        if (typeof payload.id === 'string') tabs.close(payload.id)
        break
      case 'tab:activate':
        if (typeof payload.id === 'string') tabs.activate(payload.id)
        break
      case 'tab:navigate':
        if (typeof payload.url === 'string') tabs.navigate(payload.url)
        break
      case 'tab:back':
        tabs.back()
        break
      case 'tab:forward':
        tabs.forward()
        break
      case 'tab:reload':
        tabs.reload()
        break
      default:
        console.warn('[main] unknown command:', message.cmd)
    }
  }
  ipcMain.on(IPC.command, onCommand)

  // Route the global menu's accelerators at this window while it's alive.
  activeActions = {
    newTab,
    closeTab: () => tabs.closeActive(),
    focusUrlBar,
    nextTab: () => tabs.activateAdjacent(1),
    prevTab: () => tabs.activateAdjacent(-1),
    reload: () => tabs.reload()
  }

  // Flush persisted state while the window and tabs are still alive ('close'
  // fires before 'closed', which tears everything down).
  mainWindow.on('close', () => {
    persistWindow()
    persistTabs()
  })

  // Tear down per-window resources: BaseWindow doesn't dispose child views, and
  // ipcMain listeners accumulate across window re-creations (macOS activate).
  mainWindow.on('closed', () => {
    ipcMain.removeListener(IPC.command, onCommand)
    tabs.destroy()
    if (!chromeView.webContents.isDestroyed()) chromeView.webContents.close()
    if (activeActions?.newTab === newTab) activeActions = null
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
  // Restore last session's tabs, or open a default first tab.
  const savedTabs = settings.getOpenTabs()
  if (savedTabs.urls.length > 0) {
    const ids = savedTabs.urls.map((url) => tabs.create(url))
    const target = ids[savedTabs.activeIndex] ?? ids[0]
    if (target) tabs.activate(target)
  } else {
    tabs.create('https://example.com')
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  initHistory()
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
