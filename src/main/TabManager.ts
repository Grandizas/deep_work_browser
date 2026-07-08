import {
  WebContentsView,
  Menu,
  clipboard,
  type BaseWindow,
  type Rectangle,
  type WebContents,
  type MenuItemConstructorOptions
} from 'electron'
import { toNavigationUrl, originOf } from '../shared/url'
import { interstitialUrl, parseInterstitialAction } from './interstitial'
import { siteOf } from './blocking'
import type { BrowserState, TabState } from '../shared/types'

interface Tab {
  id: string
  // The tab's WebContentsView, or null for a lazily-restored placeholder that
  // hasn't been activated yet — no view and no renderer are created until then.
  view: WebContentsView | null
  favicon: string | null
  // When a load fails we show a local error page; this remembers the URL the
  // user actually tried so the address bar keeps showing it (not the data URL).
  errorUrl: string | null
  // When a navigation is blocked we show the interstitial; this remembers the
  // blocked destination for the address bar and for "reload"/"continue".
  blockedUrl: string | null
  // After "Continue Anyway", the site (registrable domain) the user chose to
  // override, so its own redirects/navigations aren't re-blocked. Cleared when
  // navigating to a different site.
  overrideSite: string | null
  // True while showing the internal new-tab dashboard (a baked data URL). The
  // address bar shows empty for these so a new tab is ready to type into.
  isHome: boolean
  // A restored-but-not-yet-materialized tab: its saved URL. While set, `view` is
  // null (no WebContentsView, no renderer). First activation builds the view and
  // loads this. The strip shows the URL meanwhile so the session looks restored.
  pendingUrl: string | null
  // True while this tab is playing audio — drives ambient-sound ducking.
  audible: boolean
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
    private readonly onNavigate: (info: { url: string; title: string }) => void,
    // Blocking decision for a candidate navigation (workspace + focus aware).
    private readonly decide: (url: string) => 'allow' | 'block',
    // Called when the user chooses "Continue Anyway" past the interstitial.
    private readonly onOverride: (url: string) => void,
    // Called when a top-level navigation is blocked (interstitial shown).
    private readonly onBlock: (url: string) => void,
    // Builds the internal new-tab page (dashboard) as a data URL, on demand.
    private readonly homePage: () => string,
    // Reports find-in-page results (1-based current match, total) for the find bar.
    private readonly onFound: (current: number, total: number) => void,
    // The saved zoom level for an origin, applied to a page after it navigates.
    private readonly zoomFor: (origin: string) => number
  ) {}

  private get active(): Tab | undefined {
    return this.tabs.find((t) => t.id === this.activeId)
  }

  /**
   * Create a tab, load `url`, and make it active. `block` runs the URL through
   * the blocking engine (showing the interstitial if blocked); pass false to
   * bypass it (e.g. restoring a session's tabs). Returns the new tab id.
   */
  create(url = 'about:blank', block = true): string {
    const tab = this.newTabRecord()
    this.materialize(tab)
    this.loadInTab(tab, url, block)
    this.activate(tab.id)
    return tab.id
  }

  // A bare Tab record with no view yet. Materialized eagerly by create() or on
  // first activation for a lazy placeholder.
  private newTabRecord(): Tab {
    const tab: Tab = {
      id: nextId(),
      view: null,
      favicon: null,
      errorUrl: null,
      blockedUrl: null,
      overrideSite: null,
      isHome: false,
      pendingUrl: null,
      audible: false
    }
    this.tabs.push(tab)
    return tab
  }

  /** Whether any tab is currently playing audio (for ambient-sound ducking). */
  anyAudible(): boolean {
    return this.tabs.some((t) => t.audible)
  }

  // Build the tab's WebContentsView (spawning its renderer) and wire its events.
  // No-op if already materialized. This is the per-tab cost lazy restore defers.
  private materialize(tab: Tab): void {
    if (tab.view) return
    tab.view = new WebContentsView({
      webPreferences: {
        partition: this.partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.window.contentView.addChildView(tab.view)
    this.wireEvents(tab)
  }

  /**
   * Create a restored tab as a pure placeholder — no WebContentsView, no
   * renderer — until it's first activated. Restoring a big session is cheap:
   * only the visible tab pays for a view; the rest cost one record each.
   */
  private createLazy(url: string): string {
    const tab = this.newTabRecord()
    tab.pendingUrl = url
    return tab.id
  }

  /**
   * Restore a saved session's tabs: the active one loads immediately, the rest
   * lazily (on first activation). Restored URLs bypass the block check — the user
   * explicitly had them open.
   */
  restore(urls: string[], activeIndex: number): void {
    if (urls.length === 0) return
    const active = urls[activeIndex] !== undefined ? activeIndex : 0
    const ids = urls.map((url, i) =>
      i === active ? this.create(url, false) : this.createLazy(url)
    )
    this.activate(ids[active])
  }

  // Load a URL into a tab, routing blocked distractions to the interstitial.
  // A blank target (empty or about:blank — the latter is how a persisted home
  // tab round-trips) loads the internal new-tab dashboard instead.
  private loadInTab(tab: Tab, url: string, check: boolean): void {
    if (!tab.view) return
    // Was this exact URL already the one being blocked? Then this is a reload of
    // the interstitial, not a fresh attempt — don't double-count the block.
    const reblockingSame = tab.blockedUrl === url
    tab.errorUrl = null
    tab.blockedUrl = null
    tab.overrideSite = null
    tab.isHome = false
    if (!url || url === 'about:blank') {
      tab.isHome = true
      tab.view.webContents.loadURL(this.homePage())
    } else if (check && this.decide(url) === 'block') {
      tab.blockedUrl = url
      if (!reblockingSame) this.onBlock(url)
      tab.view.webContents.loadURL(interstitialUrl(url))
    } else {
      tab.view.webContents.loadURL(url)
    }
  }

  private wireEvents(tab: Tab): void {
    if (!tab.view) return
    const wc = tab.view.webContents
    const changed = (): void => this.onChange()

    wc.on('did-start-loading', changed)
    wc.on('did-stop-loading', changed)
    // Audio state for ambient ducking: fade the ambient sound down while a tab
    // plays audio, back up when it stops. did-navigate clears it (new page).
    wc.on('media-started-playing', () => {
      tab.audible = true
      changed()
    })
    wc.on('media-paused', () => {
      tab.audible = false
      changed()
    })
    wc.on('found-in-page', (_e, result) => {
      // Chromium only includes matches on the final result of a request; report
      // whatever it gives (activeMatchOrdinal is 1-based, 0 when nothing matches).
      this.onFound(result.activeMatchOrdinal ?? 0, result.matches ?? 0)
    })
    wc.on('did-navigate', () => {
      tab.audible = false
      // Restore this origin's saved zoom (Chromium resets zoom on cross-origin nav).
      wc.setZoomLevel(this.zoomFor(originOf(wc.getURL())))
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
    // Layer 2: intercept renderer-initiated navigations (link clicks, redirects).
    wc.on('will-navigate', (event, url) => {
      // Interstitial button actions arrive as navigations to our sentinel host.
      const action = parseInterstitialAction(url)
      if (action) {
        event.preventDefault()
        // The URL this tab is currently blocking (interstitial showing).
        const blocked = tab.blockedUrl
        tab.errorUrl = null
        tab.blockedUrl = null
        if (action.type === 'break') {
          // "Take a Break" — full break mode is Phase 5; for now, a clean slate.
          tab.overrideSite = null
          wc.loadURL('about:blank')
        } else if (blocked && action.url === blocked) {
          // Only honour Continue Anyway for the URL that was actually blocked —
          // otherwise any page could forge this navigation to bypass blocking.
          tab.overrideSite = siteOf(action.url)
          this.onOverride(action.url)
          wc.loadURL(action.url)
        }
        // A forged/stale continue (no matching interstitial) is ignored.
        return
      }
      // Stay on an overridden site (its own redirects/links) without re-blocking.
      if (tab.overrideSite && siteOf(url) === tab.overrideSite) return

      if (this.decide(url) === 'block') {
        event.preventDefault()
        tab.overrideSite = null
        tab.blockedUrl = url
        this.onBlock(url)
        wc.loadURL(interstitialUrl(url))
      } else {
        // Navigated to a different allowed site — the override no longer applies.
        tab.overrideSite = null
      }
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
    const target = this.tabs.find((t) => t.id === id)
    if (!target) return
    this.activeId = id
    // First activation of a lazy placeholder: build its view now and load its URL.
    if (!target.view) {
      this.materialize(target)
      const url = target.pendingUrl ?? 'about:blank'
      target.pendingUrl = null
      this.loadInTab(target, url, false)
    }
    for (const tab of this.tabs) {
      if (!tab.view) continue // placeholders have no view to show
      const isActive = tab.id === id
      tab.view.setVisible(isActive)
      if (isActive) tab.view.setBounds(this.bounds)
    }
    this.active?.view?.webContents.focus()
    this.onChange()
  }

  close(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    const [tab] = this.tabs.splice(idx, 1)
    if (tab.view) {
      this.window.contentView.removeChildView(tab.view)
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()
    }

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
    // Address-bar navigations don't fire will-navigate, so block-check here.
    this.loadInTab(tab, url, true)
  }

  back(): void {
    const tab = this.active
    if (!tab?.view) return
    const wc = tab.view.webContents
    if (wc.navigationHistory.canGoBack()) {
      tab.errorUrl = null
      tab.blockedUrl = null
      tab.overrideSite = null
      wc.navigationHistory.goBack()
    }
  }

  forward(): void {
    const tab = this.active
    if (!tab?.view) return
    const wc = tab.view.webContents
    if (wc.navigationHistory.canGoForward()) {
      tab.errorUrl = null
      tab.blockedUrl = null
      tab.overrideSite = null
      wc.navigationHistory.goForward()
    }
  }

  reload(): void {
    const tab = this.active
    if (!tab?.view) return
    const wc = tab.view.webContents
    // On the interstitial, reload re-checks the blocked URL (still blocked → stays).
    if (tab.blockedUrl) {
      this.loadInTab(tab, tab.blockedUrl, true)
    } else if (tab.isHome) {
      // Refresh the dashboard with a current snapshot rather than the stale one.
      this.loadInTab(tab, 'about:blank', false)
    } else if (tab.errorUrl) {
      // On an error page, reload retries the URL that failed, not the data URL.
      const retry = tab.errorUrl
      tab.errorUrl = null
      wc.loadURL(retry)
    } else {
      wc.reload()
    }
  }

  /** The active tab's current Chromium zoom level (0 = 100%). */
  getZoom(): number {
    return this.active?.view?.webContents.getZoomLevel() ?? 0
  }

  /** Set the active tab's zoom level. */
  setZoom(level: number): void {
    this.active?.view?.webContents.setZoomLevel(level)
  }

  /** Find-in-page in the active tab. `findNext` steps through existing matches. */
  find(text: string, options?: { forward?: boolean; findNext?: boolean }): void {
    const wc = this.active?.view?.webContents
    if (!wc) return
    if (!text) {
      wc.stopFindInPage('clearSelection')
      this.onFound(0, 0)
      return
    }
    wc.findInPage(text, options)
  }

  /** Clear the active tab's find highlights (closing the find bar). */
  stopFind(): void {
    this.active?.view?.webContents.stopFindInPage('clearSelection')
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
    this.active?.view?.setBounds(bounds)
  }

  /** Hide all of this workspace's tabs (on switching away). Views stay alive. */
  hide(): void {
    for (const tab of this.tabs) tab.view?.setVisible(false)
  }

  /** Show this workspace's active tab in `bounds` (on switching to it). */
  show(bounds: Rectangle): void {
    this.bounds = bounds
    for (const tab of this.tabs) tab.view?.setVisible(tab.id === this.activeId)
    this.active?.view?.setBounds(bounds)
    this.active?.view?.webContents.focus()
  }

  getState(): Pick<BrowserState, 'tabs' | 'activeTabId'> {
    return {
      activeTabId: this.activeId,
      tabs: this.tabs.map((tab): TabState => {
        // An unmaterialized placeholder (no view) reports its saved URL + a
        // host-derived title, so the strip looks fully restored before it opens.
        if (!tab.view) {
          return {
            id: tab.id,
            url: tab.pendingUrl ?? '',
            title: hostTitle(tab.pendingUrl ?? ''),
            favicon: null,
            isLoading: false,
            canGoBack: false,
            canGoForward: false
          }
        }
        const wc = tab.view.webContents
        const dead = wc.isDestroyed()
        return {
          id: tab.id,
          url: tab.isHome ? '' : (tab.blockedUrl ?? tab.errorUrl ?? (dead ? '' : wc.getURL())),
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
      if (!tab.view) continue
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

/** A placeholder tab title for a not-yet-loaded restored tab: its host, or the URL. */
function hostTitle(url: string): string {
  if (!url || url === 'about:blank') return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url
  } catch {
    return url
  }
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
