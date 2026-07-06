import { Menu, type MenuItemConstructorOptions } from 'electron'

/** Actions the app menu's accelerators drive, on the currently focused window. */
export interface MenuActions {
  newTab(): void
  closeTab(): void
  focusUrlBar(): void
  nextTab(): void
  prevTab(): void
  reload(): void
}

/**
 * Install the application menu. Accelerators fire regardless of which view has
 * OS focus (so shortcuts work even while a tab page is focused). `getActions`
 * resolves the target window lazily so the menu can be built once up front.
 */
export function installAppMenu(getActions: () => MenuActions | null): void {
  const run = (fn: (a: MenuActions) => void) => (): void => {
    const actions = getActions()
    if (actions) fn(actions)
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: run((a) => a.newTab()) },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: run((a) => a.closeTab()) },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: run((a) => a.reload()) },
        {
          label: 'Focus Address Bar',
          accelerator: 'CmdOrCtrl+L',
          click: run((a) => a.focusUrlBar())
        },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Control+Tab', click: run((a) => a.nextTab()) },
        { label: 'Previous Tab', accelerator: 'Control+Shift+Tab', click: run((a) => a.prevTab()) },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
