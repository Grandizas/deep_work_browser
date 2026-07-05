# deep_work_browser

> A browser that reduces decisions, not adds features.

When you open it, it asks one question: **What are you working on today?**
Then everything adapts — your tabs, your logins, your blocked sites, your theme.

Built with Electron, Vue 3, and TypeScript. Local-first. No accounts, no sync, no AI, no XP bars.

## Why

Chrome gives you infinite tabs and infinite distraction, and every "productivity browser" fights that by adding more dashboards. This project goes the other way: fewer choices, stronger defaults, and a gentle speed bump between you and the mindless click.

## Core ideas

**Workspaces** — Coding, Learning, Writing, Design, Finance, Personal. Each one has its own tabs, bookmarks, cookies, logins, history, and theme, backed by isolated browser sessions. Switching workspaces feels like entering another office. Your Finance logins simply don't exist in Personal.

**Focus sessions** — Start a 50-minute session. Distractions disappear, only approved sites are reachable, and the YouTube homepage is blocked (direct video links still work — a colleague sending you a specific video is not doomscrolling). When the timer ends, break mode unlocks everything.

**Website roles** — Instead of bookmarks, sites are categorized as *Essential*, *Reference*, or *Distraction*. The browser uses these roles to decide what a focus session allows.

**Gentle accountability** — Opening Reddit mid-session doesn't scold you. You get a speed bump: *"This isn't in your current workspace."* with three honest buttons — **Go Back · Take a Break · Continue Anyway**. Overrides are logged, not punished.

**Command palette** — `Ctrl+K` for everything: `timer 30`, `block youtube`, `new coding session`, jump to any site or open tab. Never touch a menu.

**Daily dashboard** — New tab shows sessions completed, focused minutes, current streak, top sites, distractions blocked. One screen. No enterprise charts.

**Website notes** — Every site gets its own scratchpad. Open GitHub, hit a shortcut, jot *"fix login bug — Supabase PKCE"*. It's there next time.

**Session restore** — *"Continue yesterday? Coding workspace, 14 tabs, timer paused at 18 minutes."* One click.

**Ambient focus** — Rain, wind, coffee shop, forest, or silence. Volume ducks automatically when a tab plays audio.

## What this is not

- ❌ No Chrome extensions
- ❌ No cloud sync or accounts — local-first, with plain JSON/SQLite data you can export
- ❌ No AI everywhere, XP bars, daily quests, or crypto rewards
- ❌ No twenty analytics pages

A focus browser should feel *lighter* than Chrome.

## Tech stack

- [Electron](https://www.electronjs.org/) — `BaseWindow` + `WebContentsView` architecture, one isolated session partition per workspace
- [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) — the browser chrome UI (tab strip, palette, dashboard)
- [electron-vite](https://electron-vite.org/) — build tooling with HMR
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — history, focus stats, notes
- [electron-store](https://github.com/sindresorhus/electron-store) — settings, workspaces, site roles
- TypeScript throughout

## Architecture in one paragraph

The main process owns all state — tabs, workspaces, focus timer, blocking rules. The Vue renderer is a pure mirror: it receives state pushes over IPC into a Pinia store and sends commands back. Each workspace maps to its own `persist:` session partition, which is what makes cookie/login/history isolation essentially free. Site blocking runs at two layers: `webRequest` on each workspace session and navigation interception, with a local interstitial page as the speed bump. Web content runs fully sandboxed with context isolation; tab pages never get a preload script.

## Status

🚧 **Early development.** Currently building core browsing (tabs, navigation, persistence). See [PLAN.md](./PLAN.md) for the full phased roadmap.

## Development

```bash
# install dependencies
npm install

# run with hot reload
npm run dev

# type-check and build
npm run build

# build distributables (Windows)
npm run build:win
```

Requires Node.js 18+.

## Project structure

```
src/
  main/       # main process: window, TabManager, workspaces, focus engine, blocking
  preload/    # contextBridge — narrow IPC surface for the chrome UI
  renderer/   # Vue 3 chrome: tab strip, URL bar, palette, dashboard, settings
```

## License

MIT
