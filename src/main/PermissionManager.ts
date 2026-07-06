import { session } from 'electron'
import type { PermissionRequest } from '../shared/types'

let seq = 0

interface Pending {
  request: PermissionRequest
  callback: (granted: boolean) => void
}

// Only these are ever surfaced to the user; everything else is denied outright.
const PROMPTED = new Set(['media', 'notifications'])

/**
 * Deny-by-default permission handling for a session. Mic/camera/notifications
 * are queued and surfaced to the chrome UI, which resolves them via
 * `permission:resolve`. Everything else is rejected without prompting.
 */
export class PermissionManager {
  private queue: Pending[] = []

  constructor(
    private readonly partition: string,
    private readonly onChange: () => void
  ) {}

  attach(): void {
    const ses = session.fromPartition(this.partition)
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      if (!PROMPTED.has(permission)) {
        callback(false)
        return
      }
      const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
      const request: PermissionRequest = {
        id: `perm-${++seq}`,
        origin: originOf(details.requestingUrl || wc.getURL()),
        types: describe(permission, mediaTypes)
      }
      this.queue.push({ request, callback })
      this.onChange()
    })
  }

  resolve(id: string, granted: boolean): void {
    const idx = this.queue.findIndex((p) => p.request.id === id)
    if (idx === -1) return
    const [pending] = this.queue.splice(idx, 1)
    pending.callback(granted)
    this.onChange()
  }

  /** The request currently shown to the user (first in the queue), or null. */
  current(): PermissionRequest | null {
    return this.queue[0]?.request ?? null
  }

  detach(): void {
    // Deny anything still outstanding, then remove the handler.
    for (const pending of this.queue) pending.callback(false)
    this.queue = []
    session.fromPartition(this.partition).setPermissionRequestHandler(null)
  }
}

/** Turn an Electron permission + media types into human-facing capability names. */
function describe(permission: string, mediaTypes: readonly string[] | undefined): string[] {
  if (permission === 'notifications') return ['notifications']
  // 'media' can be audio, video, or both.
  const media = mediaTypes ?? []
  const types: string[] = []
  if (media.includes('audio')) types.push('microphone')
  if (media.includes('video')) types.push('camera')
  return types.length ? types : ['microphone', 'camera']
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}
