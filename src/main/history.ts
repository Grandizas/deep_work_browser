import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { DashboardStats } from '../shared/types'

let db: Database.Database | null = null
let insertVisit: Database.Statement | null = null
let insertOverride: Database.Statement | null = null
let insertBlock: Database.Statement | null = null
let insertSession: Database.Statement | null = null
let countOverrides: Database.Statement | null = null

/**
 * Open the history database and ensure its schema exists. Call after app ready.
 * A corrupt or locked db.file must not take down the browser — history is a
 * non-essential logging feature, so on failure we log and stay disabled
 * (logVisit no-ops when insertVisit is null).
 */
export function initHistory(): void {
  try {
    const dbPath = join(app.getPath('userData'), 'history.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        url          TEXT    NOT NULL,
        title        TEXT,
        workspace_id TEXT,
        visited_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history (visited_at);

      CREATE TABLE IF NOT EXISTS overrides (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        url           TEXT    NOT NULL,
        workspace_id  TEXT,
        overridden_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_overrides_at ON overrides (overridden_at);

      CREATE TABLE IF NOT EXISTS blocks (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        url          TEXT    NOT NULL,
        workspace_id TEXT,
        blocked_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_blocks_at ON blocks (blocked_at);

      CREATE TABLE IF NOT EXISTS notes (
        origin     TEXT PRIMARY KEY,
        body       TEXT    NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT,
        started_at   INTEGER NOT NULL,
        ended_at     INTEGER NOT NULL,
        completed    INTEGER NOT NULL,
        overrides    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at);
    `)
    insertVisit = db.prepare(
      'INSERT INTO history (url, title, workspace_id, visited_at) VALUES (?, ?, ?, ?)'
    )
    insertOverride = db.prepare(
      'INSERT INTO overrides (url, workspace_id, overridden_at) VALUES (?, ?, ?)'
    )
    insertBlock = db.prepare('INSERT INTO blocks (url, workspace_id, blocked_at) VALUES (?, ?, ?)')
    insertSession = db.prepare(
      'INSERT INTO sessions (workspace_id, started_at, ended_at, completed, overrides) VALUES (?, ?, ?, ?, ?)'
    )
    countOverrides = db.prepare(
      'SELECT COUNT(*) AS n FROM overrides WHERE workspace_id = ? AND overridden_at BETWEEN ? AND ?'
    )
  } catch (err) {
    console.error('[history] initialization failed; history logging disabled:', err)
    db = null
    insertVisit = null
    insertOverride = null
    insertBlock = null
    insertSession = null
    countOverrides = null
  }
}

/** Log a single navigation. Skips blank/internal pages. workspaceId is null until Phase 3. */
export function logVisit(url: string, title: string, workspaceId: string | null): void {
  if (!insertVisit) return
  if (!url || url === 'about:blank' || url.startsWith('data:') || url.startsWith('devtools:')) {
    return
  }
  insertVisit.run(url, title || null, workspaceId, Date.now())
}

/** Recent distinct history entries whose url or title matches `query`. */
export function searchHistory(
  query: string,
  limit: number
): { url: string; title: string | null }[] {
  if (!db || !query) return []
  const like = `%${query}%`
  return db
    .prepare(
      `SELECT url, title, MAX(visited_at) AS v FROM history
       WHERE url LIKE ? OR title LIKE ?
       GROUP BY url ORDER BY v DESC LIMIT ?`
    )
    .all(like, like, limit) as { url: string; title: string | null }[]
}

/** Log a "Continue Anyway" override past the blocking interstitial. */
export function logOverride(url: string, workspaceId: string | null): void {
  if (!insertOverride || !url) return
  insertOverride.run(url, workspaceId, Date.now())
}

/** Log a top-level navigation blocked by the engine (interstitial shown). */
export function logBlock(url: string, workspaceId: string | null): void {
  if (!insertBlock || !url) return
  insertBlock.run(url, workspaceId, Date.now())
}

// --- Daily dashboard --------------------------------------------------------

/** Epoch ms for the start (00:00 local) of the day `daysAgo` days before today. */
function startOfLocalDay(daysAgo: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.getTime()
}

/** Local YYYY-MM-DD key for an epoch-ms timestamp (timezone-correct). */
function localDateKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Consecutive local days ending today (or yesterday, as a grace period so the
 * streak doesn't read 0 all morning) that each have ≥1 completed session.
 */
function computeStreak(sessionTimes: number[]): number {
  if (sessionTimes.length === 0) return 0
  const days = new Set(sessionTimes.map(localDateKey))
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  // If today has no session yet, start counting from yesterday — the chain only
  // breaks once a full day passes with nothing.
  if (!days.has(localDateKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(localDateKey(cursor.getTime()))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Rank origins (registrable-ish host, www-stripped) by visit count. */
function topOrigins(urls: string[], limit: number): { origin: string; visits: number }[] {
  const counts = new Map<string, number>()
  for (const url of urls) {
    let origin: string
    try {
      origin = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    if (origin) counts.set(origin, (counts.get(origin) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([origin, visits]) => ({ origin, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit)
}

/**
 * Snapshot the day's stats for one workspace's new-tab dashboard. Every query
 * filters by workspace_id so each workspace sees only its own numbers — the same
 * isolation the per-workspace partitions and history give the rest of the app.
 * Empty when db is down.
 */
export function getDashboardStats(workspaceId: string): DashboardStats {
  const empty: DashboardStats = {
    sessionsToday: 0,
    focusedMinutesToday: 0,
    streak: 0,
    topSites: [],
    blockedToday: 0
  }
  if (!db) return empty
  const dayStart = startOfLocalDay(0)

  const sess = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(ended_at - started_at), 0) AS ms
       FROM sessions WHERE completed = 1 AND workspace_id = ? AND started_at >= ?`
    )
    .get(workspaceId, dayStart) as { n: number; ms: number }

  const blocked = db
    .prepare(`SELECT COUNT(*) AS n FROM blocks WHERE workspace_id = ? AND blocked_at >= ?`)
    .get(workspaceId, dayStart) as { n: number }

  const visits = db
    .prepare(`SELECT url FROM history WHERE workspace_id = ? AND visited_at >= ?`)
    .all(workspaceId, dayStart) as { url: string }[]

  const completed = db
    .prepare(
      `SELECT started_at FROM sessions WHERE completed = 1 AND workspace_id = ? ORDER BY started_at DESC`
    )
    .all(workspaceId) as { started_at: number }[]

  return {
    sessionsToday: sess.n,
    focusedMinutesToday: Math.round(sess.ms / 60_000),
    streak: computeStreak(completed.map((r) => r.started_at)),
    topSites: topOrigins(
      visits.map((v) => v.url),
      5
    ),
    blockedToday: blocked.n
  }
}

/**
 * Log a finished focus session. `overrides` is the count of Continue-Anyway
 * overrides in that workspace during the session window.
 */
export function logSession(
  workspaceId: string,
  startedAt: number,
  endedAt: number,
  completed: boolean
): void {
  if (!insertSession || !countOverrides) return
  const { n } = countOverrides.get(workspaceId, startedAt, endedAt) as { n: number }
  insertSession.run(workspaceId, startedAt, endedAt, completed ? 1 : 0, n)
}

// --- Website notes ----------------------------------------------------------

/** The saved note body for an origin, or '' when there's none. */
export function getNote(origin: string): string {
  if (!db || !origin) return ''
  const row = db.prepare(`SELECT body FROM notes WHERE origin = ?`).get(origin) as
    { body: string } | undefined
  return row?.body ?? ''
}

/** Upsert a note for an origin. An empty/whitespace body deletes it. */
export function setNote(origin: string, body: string): void {
  if (!db || !origin) return
  const trimmed = body.trim()
  if (!trimmed) {
    db.prepare(`DELETE FROM notes WHERE origin = ?`).run(origin)
    return
  }
  db.prepare(
    `INSERT INTO notes (origin, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(origin) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`
  ).run(origin, trimmed, Date.now())
}

/** Whether an origin has a (non-empty) note — drives the URL-bar indicator. */
export function hasNote(origin: string): boolean {
  if (!db || !origin) return false
  return !!db.prepare(`SELECT 1 FROM notes WHERE origin = ?`).get(origin)
}

/** Total number of saved notes (for the resume card's "N notes"). */
export function countNotes(): number {
  if (!db) return 0
  const row = db.prepare(`SELECT COUNT(*) AS n FROM notes`).get() as { n: number }
  return row.n
}

/** All notes, most-recently-edited first, for the palette `notes` listing. */
export function listNotes(): { origin: string; body: string }[] {
  if (!db) return []
  return db.prepare(`SELECT origin, body FROM notes ORDER BY updated_at DESC`).all() as {
    origin: string
    body: string
  }[]
}

export function closeHistory(): void {
  db?.close()
  db = null
  insertVisit = null
  insertOverride = null
  insertBlock = null
  insertSession = null
  countOverrides = null
}
