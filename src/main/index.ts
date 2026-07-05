import { app, BaseWindow, WebContentsView, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC, type BrowserState, type CommandMessage } from '../shared/types'

// Height of the chrome UI strip (tab bar + URL bar) along the top of the window.
const CHROME_HEIGHT = 88

function createWindow(): void {
  const mainWindow = new BaseWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {})
  })

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

  // Tab: a single web page rendered below the chrome strip. Untrusted content,
  // so it is fully sandboxed with no preload — it can never reach the IPC bridge.
  const tabView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.contentView.addChildView(tabView)

  // --- State plumbing: main owns the truth, the chrome renderer mirrors it. ---

  // Build the authoritative state from the current tab.
  const currentState = (): BrowserState => {
    const wc = tabView.webContents
    if (wc.isDestroyed()) return { activeTab: null }
    return {
      activeTab: {
        url: wc.getURL(),
        title: wc.getTitle(),
        isLoading: wc.isLoading()
      }
    }
  }

  // Push the latest state to the chrome renderer's Pinia store.
  const pushState = (): void => {
    if (chromeView.webContents.isDestroyed()) return
    chromeView.webContents.send(IPC.stateUpdate, currentState())
  }

  // Reflect the tab's navigation/loading changes into the mirrored state.
  const tab = tabView.webContents
  tab.on('did-navigate', pushState)
  tab.on('did-navigate-in-page', pushState)
  tab.on('page-title-updated', pushState)
  tab.on('did-start-loading', pushState)
  tab.on('did-stop-loading', pushState)

  // Commands flow the other way. Reject anything not sent by our chrome view —
  // a sandboxed tab page must never be able to drive the browser.
  const onCommand = (event: Electron.IpcMainEvent, message: CommandMessage): void => {
    if (event.sender !== chromeView.webContents) return
    if (!message || typeof message.cmd !== 'string') return

    switch (message.cmd) {
      case 'ui:ready':
        // Renderer mounted and subscribed — send it the initial snapshot.
        pushState()
        break
      default:
        console.warn('[main] unknown command:', message.cmd)
    }
  }
  ipcMain.on(IPC.command, onCommand)

  // Keep the chrome strip and tab view sized to the window's content area.
  const layoutViews = (): void => {
    const { width, height } = mainWindow.getContentBounds()
    chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT })
    tabView.setBounds({ x: 0, y: CHROME_HEIGHT, width, height: height - CHROME_HEIGHT })
  }

  layoutViews()
  mainWindow.on('resize', layoutViews)

  // Tear down per-window resources. BaseWindow does not dispose child
  // WebContentsView renderers, and ipcMain listeners accumulate across
  // window re-creations (e.g. macOS activate) — clean up both here.
  mainWindow.on('closed', () => {
    ipcMain.removeListener(IPC.command, onCommand)
    if (!chromeView.webContents.isDestroyed()) chromeView.webContents.close()
    if (!tabView.webContents.isDestroyed()) tabView.webContents.close()
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

  tabView.webContents.loadURL('https://example.com')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
