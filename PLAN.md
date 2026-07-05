# deep_work_browser — Build Plan

Core philosophy: the browser reduces decisions. Every phase must ship something usable; never two half-built features at once.

## Architectural decisions (read first, these shape everything)

1. **One Electron `session` partition per workspace.** `session.fromPartition('persist:ws-coding')` etc. This gives each workspace its own cookies, localStorage, cache, and logins *for free*. This is the keystone — build it in from Phase 3 and never share a default session across workspaces.
2. **Main process owns all truth.** Tabs, workspaces, timer, blocking rules live in the main process. The Vue chrome UI is a dumb mirror: it receives state via IPC push (`state:update` events into a Pinia store) and sends commands (`cmd:*`). Never let the renderer hold authoritative state.
3. **Own history + stats in SQLite (`better-sqlite3`).** Chromium's history isn't exposed, and you need per-workspace history anyway. Log `did-navigate` events with `{url, title, workspaceId, timestamp}`. Settings/workspaces/roles config goes in `electron-store` (JSON) — small, human-readable, easy to debug.
4. **Blocking happens at two layers.** `session.webRequest.onBeforeRequest` (network layer, per workspace session) + `will-navigate` / `setWindowOpenHandler` (navigation layer). The interstitial "speed bump" is a local page (`app://` or `loadFile`) with the blocked URL passed as a query param.
5. **No extensions.** Ad blocking via `@ghostery/adblocker-electron` instead. Revisit never.

---

## Phase 0 — Foundation (replace the scaffold)

Goal: empty browser skeleton running.

- [x] Strip scaffold demo code from `src/main`, `src/preload`, `src/renderer`
- [x] `BaseWindow` + chrome `WebContentsView` (top ~88px) + one tab `WebContentsView`
- [x] Resize handler keeping bounds in sync
- [x] Preload: `contextBridge` exposing exactly two things: `send(cmd, payload)` and `onState(callback)`
- [x] Security defaults: chrome view `contextIsolation: true, nodeIntegration: false`; tab views additionally `sandbox: true`, no preload
- [x] IPC sender validation in main (reject commands not from the chrome view's frame)
- [x] Pinia store in renderer that mirrors a `BrowserState` object pushed from main

Done when: app opens, Vue strip on top, example.com below, resizing works.

## Phase 1 — Core browsing

Goal: usable single-workspace browser.

- [x] `TabManager` class in main: create / close / activate / navigate; tab = `{id, view, url, title, favicon, isLoading, canGoBack, canGoForward}`
- [x] Wire per-tab events: `did-navigate`, `did-navigate-in-page`, `page-title-updated`, `page-favicon-updated`, `did-start-loading`, `did-stop-loading`
- [x] `setWindowOpenHandler` → new tab in your strip, never a popup window
- [x] Tab bar UI (Vue): favicons, titles, close buttons, active state
- [x] URL bar: navigate on Enter, smart handling (URL vs search query → default to a search engine), show current URL on navigation
- [x] Back / forward / reload buttons
- [x] Shortcuts via `Menu` accelerators: Ctrl+T, Ctrl+W, Ctrl+L (focus URL bar), Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+R
- [x] Basic error page (load failure → friendly local page)

Done when: you can daily-drive it for casual browsing without swearing.

## Phase 2 — Persistence baseline

Goal: it remembers things across restarts.

- [x] `persist:` session partition so logins survive restart
- [x] `electron-store` setup: window bounds, last open tabs
- [ ] SQLite setup (`better-sqlite3`): `history` table, log every navigation
- [ ] Downloads: `session.on('will-download')` → minimal download list in chrome UI
- [ ] Permission handler: `setPermissionRequestHandler` — deny by default, prompt through chrome UI for mic/camera/notifications
- [ ] Context menu on tab pages (`context-menu` package or manual): open link in new tab, copy link, inspect

Done when: restart restores your tabs and logins.

## Phase 3 — Workspaces (the big one)

Goal: switching workspaces feels like entering another office.

- [ ] `Workspace` model: `{id, name, emoji, themeColor, partition, tabIds, pinnedSites}` in electron-store
- [ ] Each workspace's tabs created with its own `persist:ws-<id>` partition
- [ ] Workspace switcher UI (sidebar or top-left dropdown) with the six defaults: Coding, Learning, Writing, Design, Finance, Personal
- [ ] Switching = hide current workspace's views, show target's (keep views alive; cap total live tabs later if memory becomes an issue)
- [ ] Per-workspace theme: accent color / subtle background shift in chrome UI (you have the SCSS chops — keep it to CSS variables driven by workspace)
- [ ] Per-workspace bookmarks (pinned sites row)
- [ ] History logging tagged with `workspaceId`
- [ ] Startup prompt: "What are you working on today?" → workspace picker as the first screen

Done when: Finance logins don't exist in Personal; each workspace reopens with its own tabs.

## Phase 4 — Website roles + blocking engine

Goal: the browser knows what each site is.

- [ ] Roles config in electron-store: `{essential: [], reference: [], distractions: []}` — global list with per-workspace overrides
- [ ] Simple management UI (settings page as an internal route in the chrome renderer, or an internal `app://settings` page)
- [ ] Blocking engine in main: given active workspace + focus state, decide allow / block per navigation
- [ ] Layer 1: `webRequest.onBeforeRequest` on each workspace session (catches embeds, redirects)
- [ ] Layer 2: `will-navigate` interception → redirect to interstitial
- [ ] Interstitial page: "This isn't in your current workspace." with **Go Back / Take a Break / Continue Anyway** buttons (buttons message main via a query-param-driven local page + tiny dedicated preload for just this page)
- [ ] "Continue Anyway" logs the override to SQLite (this powers the dashboard's honesty later)
- [ ] Special-case rules: block YouTube *homepage* but allow direct video URLs (path-based rule: block `youtube.com/$` and `/feed/*`, allow `/watch`)

Done when: opening Reddit in Coding workspace shows the speed bump, and Continue Anyway still works (no guilt trips, per the philosophy).

## Phase 5 — Focus sessions

Goal: 50-minute sessions that actually change browser behavior.

- [ ] `FocusManager` in main: `{state: idle|focus|break, endsAt, workspaceId, allowlist}` — timer lives in main so it survives UI reloads
- [ ] Start session UI: duration presets (25/50/90), uses current workspace's Essential+Reference sites as allowlist
- [ ] During focus: blocking engine switches from "block distractions" to "allow only approved" mode
- [ ] Timer display in chrome UI (subtle, always visible)
- [ ] Session end: 🎉 completion screen, auto-start break mode (everything unlocked), break countdown
- [ ] Pause/resume; persist timer state so a crash/restart restores it (feeds Session Restore later)
- [ ] Log sessions to SQLite: `{start, end, workspaceId, completed, overrides}`

Done when: a full 50-min session works end to end, and stats are being recorded.

## Phase 6 — Command palette

Goal: never touch menus.

- [ ] Ctrl+K overlay in the chrome renderer (this is pure Vue work — your comfort zone)
- [ ] Command registry: static commands + parameterized (`timer 30`, `block youtube`) + fuzzy site jump (searches history + roles + open tabs)
- [ ] Commands dispatch through the same IPC `cmd:*` channel — the palette is just another caller
- [ ] Minimum command set: `timer <min>`, `new <workspace> session`, `block <site>`, `notes`, `today` (dashboard), workspace names, open-tab switching, history search

Done when: you stop using the mouse for navigation.

## Phase 7 — Daily dashboard (new tab page)

Goal: open a new tab, see your day.

- [ ] New tab = internal page rendered by your chrome renderer (route) or a dedicated local page
- [ ] Queries SQLite: sessions completed today, focused minutes, streak (consecutive days with ≥1 completed session), top visited sites, distractions blocked count
- [ ] Keep it to one screen, no charts by default (per your philosophy) — a single "show details" expander max
- [ ] Streak logic careful with timezones; compute from local dates

Done when: the dashboard replaces any urge for a separate stats app.

## Phase 8 — Website notes

- [ ] SQLite `notes` table keyed by origin (`github.com`), not full URL
- [ ] Shortcut (e.g. Ctrl+Shift+N) opens a slide-over panel in chrome UI showing notes for the active tab's origin
- [ ] Plain textarea + autosave. No rich text. Resist the urge.
- [ ] Note indicator dot on the URL bar when the current site has notes
- [ ] `notes` command in palette lists all notes

## Phase 9 — Session restore

- [ ] On startup (after workspace picker): "Continue yesterday?" card — last workspace, tab count, notes touched, paused timer state
- [ ] One click restores tabs (lazy-load: create tab entries but only load the active one's URL; load others on activation — keeps startup fast)
- [ ] Wire in the persisted focus timer from Phase 5

## Phase 10 — Ambient focus

- [ ] Bundled loops: rain, wind, coffee shop, forest (source CC0 audio) played in the chrome renderer via Web Audio
- [ ] Volume ducking: watch tab `webContents` `media-started-playing` / `is-currently-audible` → fade ambient down, fade back on silence
- [ ] Palette commands: `rain`, `silence`, etc.
- [ ] Optional: tie to focus sessions (auto-start chosen sound)

## Phase 11 — Polish pass

- [ ] Find in page (Ctrl+F → `webContents.findInPage`)
- [ ] Zoom controls per site (persist zoom level per origin)
- [ ] Ad/tracker blocking: `@ghostery/adblocker-electron` on every workspace session
- [ ] History UI (per workspace, searchable — mostly exists via palette already)
- [ ] App icon, installer via electron-builder, auto-update wiring (you already said Yes to the updater plugin)
- [ ] Memory guard: destroy background tab views beyond N per workspace, restore on demand

## Explicitly out of scope (write it down so future-you doesn't negotiate)

- Chrome extensions
- Sync / accounts / cloud anything — local-first, JSON+SQLite export instead
- AI features, XP, quests, rewards
- Mobile
- More than one analytics view

---

## Sequencing notes

- Phases 0–2 ≈ two weekends of evenings. Don't touch workspaces until Phase 2 is done — persistence bugs are much easier to find in a single-session world.
- Phase 3 is the highest-risk phase (view lifecycle + partitions). Budget real time; everything after it is comparatively easy.
- Phases 4+5 are the product. If motivation dips, remember: a browser with only Phases 0–5 done is already the thing you described.
- 6–10 are independent of each other — reorder by excitement.
