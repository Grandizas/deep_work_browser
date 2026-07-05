import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null
let insertVisit: Database.Statement | null = null

/** Open the history database and ensure its schema exists. Call after app ready. */
export function initHistory(): void {
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
  `)
  insertVisit = db.prepare(
    'INSERT INTO history (url, title, workspace_id, visited_at) VALUES (?, ?, ?, ?)'
  )
}

/** Log a single navigation. Skips blank/internal pages. workspaceId is null until Phase 3. */
export function logVisit(url: string, title: string, workspaceId: string | null): void {
  if (!insertVisit) return
  if (!url || url === 'about:blank' || url.startsWith('data:') || url.startsWith('devtools:')) {
    return
  }
  insertVisit.run(url, title || null, workspaceId, Date.now())
}

export function closeHistory(): void {
  db?.close()
  db = null
  insertVisit = null
}
