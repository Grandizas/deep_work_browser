import { app, BaseWindow, WebContentsView } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

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

  // Chrome UI: the Vue renderer strip pinned to the top of the window.
  const chromeView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.contentView.addChildView(chromeView)

  // Tab: a single web page rendered below the chrome strip.
  const tabView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.contentView.addChildView(tabView)

  // Keep the chrome strip and tab view sized to the window's content area.
  const layoutViews = (): void => {
    const { width, height } = mainWindow.getContentBounds()
    chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT })
    tabView.setBounds({ x: 0, y: CHROME_HEIGHT, width, height: height - CHROME_HEIGHT })
  }

  layoutViews()
  mainWindow.on('resize', layoutViews)

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
