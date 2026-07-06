import { app, session, shell, type DownloadItem } from 'electron'
import { existsSync } from 'fs'
import { join, extname, basename } from 'path'
import type { DownloadState } from '../shared/types'

let seq = 0

interface Entry {
  item: DownloadItem
  state: DownloadState
}

/**
 * Tracks downloads for one session partition. Auto-saves to the OS Downloads
 * folder (like Chrome's default) so nothing blocks on a save dialog, mirrors
 * progress into DownloadState, and drives cancel / open / clear from the UI.
 *
 * The session is shared across windows, so with multiple windows this should
 * become a singleton per partition; for now it is per-window.
 */
export class DownloadManager {
  private entries: Entry[] = []
  private listener: ((event: Electron.Event, item: DownloadItem) => void) | null = null

  constructor(
    private readonly partition: string,
    private readonly onChange: () => void
  ) {}

  attach(): void {
    const ses = session.fromPartition(this.partition)
    this.listener = (_event, item): void => this.track(item)
    ses.on('will-download', this.listener)
  }

  detach(): void {
    if (this.listener) {
      session.fromPartition(this.partition).removeListener('will-download', this.listener)
      this.listener = null
    }
  }

  private track(item: DownloadItem): void {
    const savePath = reserveUniquePath(join(app.getPath('downloads'), item.getFilename()))
    item.setSavePath(savePath)

    const id = `dl-${++seq}`
    const entry: Entry = {
      item,
      state: {
        id,
        filename: item.getFilename(),
        url: item.getURL(),
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state: 'progressing',
        savePath
      }
    }
    this.entries.push(entry)

    item.on('updated', (_e, updatedState) => {
      entry.state.receivedBytes = item.getReceivedBytes()
      entry.state.totalBytes = item.getTotalBytes()
      entry.state.state =
        updatedState === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing'
      this.onChange()
    })
    item.once('done', (_e, doneState) => {
      // doneState is 'completed' | 'cancelled' | 'interrupted'
      releasePath(savePath)
      entry.state.state = doneState
      entry.state.receivedBytes = item.getReceivedBytes()
      entry.state.totalBytes = item.getTotalBytes()
      this.onChange()
    })

    this.onChange()
  }

  cancel(id: string): void {
    const entry = this.entries.find((e) => e.state.id === id)
    if (entry && (entry.state.state === 'progressing' || entry.state.state === 'paused')) {
      entry.item.cancel()
    }
  }

  open(id: string): void {
    const entry = this.entries.find((e) => e.state.id === id)
    if (entry && entry.state.state === 'completed' && entry.state.savePath) {
      shell.openPath(entry.state.savePath)
    }
  }

  clearFinished(): void {
    this.entries = this.entries.filter(
      (e) => e.state.state === 'progressing' || e.state.state === 'paused'
    )
    this.onChange()
  }

  getState(): DownloadState[] {
    return this.entries.map((e) => ({ ...e.state }))
  }
}

// Paths already handed to in-flight downloads. `will-download` fires before the
// file exists on disk, so existsSync alone can't stop two same-named concurrent
// downloads from picking the same path — we reserve here and release on 'done'.
// Stored lower-cased since the target filesystem (Windows) is case-insensitive.
const reservedPaths = new Set<string>()

const isTaken = (path: string): boolean => existsSync(path) || reservedPaths.has(path.toLowerCase())

/** Append " (n)" before the extension until the path is free, then reserve it. */
function reserveUniquePath(path: string): string {
  let candidate = path
  if (isTaken(candidate)) {
    const dir = path.slice(0, path.length - basename(path).length)
    const ext = extname(path)
    const stem = basename(path, ext)
    let n = 1
    do {
      candidate = join(dir, `${stem} (${n})${ext}`)
      n++
    } while (isTaken(candidate))
  }
  reservedPaths.add(candidate.toLowerCase())
  return candidate
}

function releasePath(path: string): void {
  reservedPaths.delete(path.toLowerCase())
}
