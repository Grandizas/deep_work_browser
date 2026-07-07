import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null
let insertVisit: Database.Statement | null = null
let insertOverride: Database.Statement | null = null

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
    `)
    insertVisit = db.prepare(
      'INSERT INTO history (url, title, workspace_id, visited_at) VALUES (?, ?, ?, ?)'
    )
    insertOverride = db.prepare(
      'INSERT INTO overrides (url, workspace_id, overridden_at) VALUES (?, ?, ?)'
    )
  } catch (err) {
    console.error('[history] initialization failed; history logging disabled:', err)
    db = null
    insertVisit = null
    insertOverride = null
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

/** Log a "Continue Anyway" override past the blocking interstitial. */
export function logOverride(url: string, workspaceId: string | null): void {
  if (!insertOverride || !url) return
  insertOverride.run(url, workspaceId, Date.now())
}

export function closeHistory(): void {
  db?.close()
  db = null
  insertVisit = null
  insertOverride = null
}
