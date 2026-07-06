import {
  WebContentsView,
  Menu,
  clipboard,
  type BaseWindow,
  type Rectangle,
  type WebContents,
  type MenuItemConstructorOptions
} from 'electron'
import { toNavigationUrl } from '../shared/url'
import type { BrowserState, TabState } from '../shared/types'

interface Tab {
  id: string
  view: WebContentsView
  favicon: string | null
  // When a load fails we show a local error page; this remembers the URL the
  // user actually tried so the address bar keeps showing it (not the data URL).
  errorUrl: string | null
}

let tabSeq = 0
const nextId = (): string => `tab-${++tabSeq}`

/**
 * Owns every tab's WebContentsView for one window: create / close / activate /
 * navigate, plus per-tab event wiring. Only the active tab is visible; all tabs
 * share the same content region below the chrome strip. Any change calls
 * `onChange`, which the window uses to push fresh state to the renderer.
 */
export class TabManager {
  private tabs: Tab[] = []
  private activeId: string | null = null

  constructor(
    private readonly window: BaseWindow,
    private readonly onChange: () => void,
    private bounds: Rectangle,
    // Session partition every tab in this manager loads into. A `persist:` name
    // stores cookies/localStorage/logins on disk so they survive restart. Phase 3
    // gives each workspace its own partition; for now all tabs share one.
    private readonly partition: string,
    // Called on each top-level navigation so the caller can log history.
    private readonly onNavigate: (info: { url: string; title: string }) => void
  ) {}

  private get active(): Tab | undefined {
    return this.tabs.find((t) => t.id === this.activeId)
  }

  /** Create a tab, load `url`, and make it active. Returns the new tab id. */
  create(url = 'about:blank'): string {
    const view = new WebContentsView({
      webPreferences: {
        partition: this.partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    const tab: Tab = { id: nextId(), view, favicon: null, errorUrl: null }
    this.tabs.push(tab)
    this.window.contentView.addChildView(view)
    this.wireEvents(tab)
    view.webContents.loadURL(url)
    this.activate(tab.id)
    return tab.id
  }

  private wireEvents(tab: Tab): void {
    const wc = tab.view.webContents
    const changed = (): void => this.onChange()

    wc.on('did-start-loading', changed)
    wc.on('did-stop-loading', changed)
    wc.on('did-navigate', () => {
      changed()
      this.onNavigate({ url: wc.getURL(), title: wc.getTitle() })
    })
    wc.on('did-navigate-in-page', changed)
    wc.on('page-title-updated', changed)
    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.favicon = favicons[0] ?? null
      changed()
    })
    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // -3 is ERR_ABORTED (user navigated away mid-load) — not a real failure.
      if (!isMainFrame || errorCode === -3) return
      tab.errorUrl = validatedURL
      wc.loadURL(errorPage(validatedURL, errorDescription))
      changed()
    })
    // New windows / target=_blank open as tabs in our strip, never popups.
    wc.setWindowOpenHandler(({ url }) => {
      this.create(url)
      return { action: 'deny' }
    })

    // Right-click menu. Native popup, so it isn't clipped by the chrome view.
    wc.on('context-menu', (_e, params) => this.showContextMenu(wc, params))
  }

  private showContextMenu(wc: WebContents, params: Electron.ContextMenuParams): void {
    const items: MenuItemConstructorOptions[] = []

    if (params.linkURL) {
      items.push(
        { label: 'Open Link in New Tab', click: () => this.create(params.linkURL) },
        { label: 'Copy Link Address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' }
      )
    }
    if (params.mediaType === 'image' && params.srcURL) {
      items.push(
        { label: 'Copy Image Address', click: () => clipboard.writeText(params.srcURL) },
        { type: 'separator' }
      )
    }
    if (params.isEditable) {
      items.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' }
      )
    } else if (params.selectionText) {
      items.push({ label: 'Copy', role: 'copy' }, { type: 'separator' })
    }

    items.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => this.back() },
      {
        label: 'Forward',
        enabled: wc.navigationHistory.canGoForward(),
        click: () => this.forward()
      },
      { label: 'Reload', click: () => this.reload() },
      { type: 'separator' },
      { label: 'Inspect Element', click: () => wc.inspectElement(params.x, params.y) }
    )

    Menu.buildFromTemplate(items).popup()
  }

  activate(id: string): void {
    if (!this.tabs.some((t) => t.id === id)) return
    this.activeId = id
    for (const tab of this.tabs) {
      const isActive = tab.id === id
      tab.view.setVisible(isActive)
      if (isActive) tab.view.setBounds(this.bounds)
    }
    this.active?.view.webContents.focus()
    this.onChange()
  }

  close(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    const [tab] = this.tabs.splice(idx, 1)
    this.window.contentView.removeChildView(tab.view)
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()

    if (this.activeId !== id) {
      this.onChange()
      return
    }
    // Closed the active tab: fall to a neighbour, or open a fresh tab so the
    // window is never left with zero tabs.
    const neighbour = this.tabs[idx] ?? this.tabs[idx - 1]
    if (neighbour) {
      this.activate(neighbour.id)
    } else {
      this.activeId = null
      this.create()
    }
  }

  closeActive(): void {
    if (this.activeId) this.close(this.activeId)
  }

  navigate(input: string): void {
    const tab = this.active
    if (!tab) return
    const url = toNavigationUrl(input)
    if (!url) return
    tab.errorUrl = null
    tab.view.webContents.loadURL(url)
  }

  back(): void {
    const tab = this.active
    if (!tab) return
    const wc = tab.view.webContents
    if (wc.navigationHistory.canGoBack()) {
      tab.errorUrl = null
      wc.navigationHistory.goBack()
    }
  }

  forward(): void {
    const tab = this.active
    if (!tab) return
    const wc = tab.view.webContents
    if (wc.navigationHistory.canGoForward()) {
      tab.errorUrl = null
      wc.navigationHistory.goForward()
    }
  }

  reload(): void {
    const tab = this.active
    if (!tab) return
    const wc = tab.view.webContents
    // On an error page, reload should retry the URL that failed, not the data URL.
    if (tab.errorUrl) {
      const retry = tab.errorUrl
      tab.errorUrl = null
      wc.loadURL(retry)
    } else {
      wc.reload()
    }
  }

  /** Cycle the active tab by `delta` (+1 next, -1 previous), wrapping around. */
  activateAdjacent(delta: number): void {
    if (this.tabs.length < 2 || !this.activeId) return
    const idx = this.tabs.findIndex((t) => t.id === this.activeId)
    const next = (idx + delta + this.tabs.length) % this.tabs.length
    this.activate(this.tabs[next].id)
  }

  /** Update the region tabs occupy (called on window resize). */
  layout(bounds: Rectangle): void {
    this.bounds = bounds
    this.active?.view.setBounds(bounds)
  }

  /** Hide all of this workspace's tabs (on switching away). Views stay alive. */
  hide(): void {
    for (const tab of this.tabs) tab.view.setVisible(false)
  }

  /** Show this workspace's active tab in `bounds` (on switching to it). */
  show(bounds: Rectangle): void {
    this.bounds = bounds
    for (const tab of this.tabs) tab.view.setVisible(tab.id === this.activeId)
    this.active?.view.setBounds(bounds)
    this.active?.view.webContents.focus()
  }

  getState(): Pick<BrowserState, 'tabs' | 'activeTabId'> {
    return {
      activeTabId: this.activeId,
      tabs: this.tabs.map((tab): TabState => {
        const wc = tab.view.webContents
        const dead = wc.isDestroyed()
        return {
          id: tab.id,
          url: tab.errorUrl ?? (dead ? '' : wc.getURL()),
          title: dead ? '' : wc.getTitle(),
          favicon: tab.favicon,
          isLoading: dead ? false : wc.isLoading(),
          canGoBack: dead ? false : wc.navigationHistory.canGoBack(),
          canGoForward: dead ? false : wc.navigationHistory.canGoForward()
        }
      })
    }
  }

  destroy(): void {
    for (const tab of this.tabs) {
      this.window.contentView.removeChildView(tab.view)
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()
    }
    this.tabs = []
    this.activeId = null
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build a self-contained data-URL error page (tab views have no preload). */
function errorPage(url: string, description: string): string {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; height: 100vh; display: flex; align-items: center;
        justify-content: center; font-family: -apple-system, Segoe UI, Roboto, sans-serif;
        background: #f6f6f7; color: #1b1b1f;
      }
      @media (prefers-color-scheme: dark) { body { background: #1b1b1f; color: #ebebf5; } }
      .card { max-width: 460px; padding: 0 24px; text-align: center; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      .url { font-size: 13px; opacity: 0.7; word-break: break-all; margin: 0 0 8px; }
      .desc { font-size: 13px; opacity: 0.5; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Can't reach this page</h1>
      <p class="url">${escapeHtml(url)}</p>
      <p class="desc">${escapeHtml(description)}</p>
    </div>
  </body>
</html>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}
