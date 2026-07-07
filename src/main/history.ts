import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null
let insertVisit: Database.Statement | null = null
let insertOverride: Database.Statement | null = null
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

export function closeHistory(): void {
  db?.close()
  db = null
  insertVisit = null
  insertOverride = null
  insertSession = null
  countOverrides = null
}
