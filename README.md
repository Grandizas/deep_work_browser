# Forge

> A browser that reduces decisions, not adds features.

When you open it, it asks one question: **What are you working on today?**
Then everything adapts — your tabs, your logins, your blocked sites, your theme.

Built with Electron, Vue 3, and TypeScript. Local-first. No accounts, no sync, no AI, no XP bars.

## Why

Chrome gives you infinite tabs and infinite distraction, and every "productivity browser" fights that by adding more dashboards. Forge goes the other way: fewer choices, stronger defaults, and a gentle speed bump between you and the mindless click.

## What it does

**Workspaces** — Coding, Learning, Writing, Design, Finance, Personal. Each has its own tabs, bookmarks, cookies, logins, history, and accent, backed by isolated browser sessions. Switching workspaces feels like entering another office — your Finance logins simply don't exist in Personal.

**Focus sessions** — Start a 25/50/90-minute session. Distractions disappear, only approved sites are reachable, and the YouTube homepage is blocked (direct video links still work — a colleague sending you a video is not doomscrolling). Pause/resume any time; when the timer ends, a break unlocks everything.

**Website roles + blocking** — Sites are categorized as _Essential_, _Reference_, or _Distraction_, and a two-layer engine (network + navigation) uses those roles to decide what a focus session allows. Opening Reddit mid-session doesn't scold you — you get a speed bump (_Go Back · Take a Break · Continue Anyway_). Overrides are logged, not punished.

**Command palette** — `Ctrl+K` for everything: `timer 30`, `block youtube`, `new coding session`, `rain`, `notes`, `today`, jump to any site or open tab.

**Daily dashboard** — A new tab shows focused minutes, sessions, your streak, top sites, and distractions blocked. One screen, no enterprise charts.

**Website notes** — Every site gets its own scratchpad in the side panel, keyed by origin. Autosaves; a dot on the address bar marks sites that have notes.

**Session restore** — _"Continue where you left off? Coding · 14 tabs · 3 notes · Focus paused 18:24 left."_ One click. Restored tabs load lazily — only the active one loads immediately.

**Ambient focus** — Rain, wind, brown noise, or pink noise, procedurally synthesized with Web Audio (no audio files). Volume ducks automatically when a tab plays audio.

**Everyday browser essentials** — find in page (`Ctrl+F`), per-site zoom (persisted per origin), ad/tracker blocking (Ghostery lists on every workspace session), a searchable per-workspace history screen (`Ctrl+H`), and toggleable sidebars (`Ctrl+B` / `Ctrl+Alt+B`) to give the page more room.

## What this is not

- ❌ No Chrome extensions (ad/tracker blocking is built in instead)
- ❌ No cloud sync or accounts — local-first, with plain JSON/SQLite data
- ❌ No AI everywhere, XP bars, daily quests, or crypto rewards
- ❌ No twenty analytics pages

A focus browser should feel _lighter_ than Chrome.

## Download

Prebuilt Windows binaries are on the [**Releases**](https://github.com/Grandizas/deep_work_browser/releases) page:

- **Installer** — `Forge-<version>-setup.exe`: double-click to install (adds Start-menu + desktop shortcuts, auto-updates).
- **Portable** — `Forge-<version>-portable.exe`: no install; just run the file.

> The builds aren't code-signed yet, so Windows SmartScreen may warn on first run — click **More info → Run anyway**. macOS/Linux: build from source (below).

## Keyboard shortcuts

| Shortcut                       | Action                    |
| ------------------------------ | ------------------------- |
| `Ctrl+K`                       | Command palette           |
| `Ctrl+T` / `Ctrl+W`            | New / close tab           |
| `Ctrl+Tab` / `Ctrl+Shift+Tab`  | Next / previous tab       |
| `Ctrl+L`                       | Focus address bar         |
| `Ctrl+F`                       | Find in page              |
| `Ctrl+H` (`Cmd+Y` on macOS)    | History                   |
| `Ctrl+Shift+N`                 | Website notes             |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset     |
| `Ctrl+B` / `Ctrl+Alt+B`        | Toggle left / right sidebar |

## Tech stack

- [Electron](https://www.electronjs.org/) — `BaseWindow` + `WebContentsView` architecture, one isolated session partition per workspace
- [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) — the browser chrome UI (sidebars, tab strip, palette, dashboard)
- [electron-vite](https://electron-vite.org/) — build tooling with HMR; [electron-builder](https://www.electron.build/) for distributables + auto-update
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — history, focus stats, notes
- [electron-store](https://github.com/sindresorhus/electron-store) — settings, workspaces, site roles
- [@ghostery/adblocker-electron](https://github.com/ghostery/adblocker) — ad/tracker blocking
- TypeScript throughout

## Architecture in one paragraph

The main process owns all state — tabs, workspaces, focus timer, blocking rules, sidebar layout. The Vue renderer is a pure mirror: it receives state pushes over IPC into a Pinia store and sends commands back. Each workspace maps to its own `persist:` session partition, which makes cookie/login/history isolation essentially free. The chrome renderer fills the window and draws the frame; the active tab's `WebContentsView` is inset as a card between the sidebars. Site blocking runs at two layers (`webRequest` per session + navigation interception) with a local interstitial as the speed bump. Web content runs fully sandboxed with context isolation; tab pages never get a preload script.

## Build from source

```bash
npm install         # install dependencies
npm run dev         # run with hot reload
npm run build       # type-check + build
npm run build:win   # Windows installer + portable exe (dist/)
npm run build:mac   # macOS
npm run build:linux # Linux (AppImage / snap / deb)
```

Requires Node.js 18+.

## Project structure

```
src/
  main/       # main process: window, TabManager, workspaces, focus engine, blocking, adblock
  preload/    # contextBridge — narrow IPC surface (send + onState)
  renderer/   # Vue 3 chrome: sidebars, tab strip, URL bar, palette, dashboard, settings
```

See [PLAN.md](./PLAN.md) for the full phased build log.

## Status

✅ Feature-complete for personal use (Phases 0–11 + the Forge redesign). Not code-signed or security-audited — see the note under [Download](#download).

## License

MIT
