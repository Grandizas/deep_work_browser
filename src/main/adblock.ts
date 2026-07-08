import { ElectronBlocker, fromElectronDetails } from '@ghostery/adblocker-electron'
import type { OnBeforeRequestListenerDetails } from 'electron'

// Ad/tracker blocking via Ghostery's engine. We can't use the package's
// `enableBlockingInSession` here: it owns the session's `onBeforeRequest` (which
// our per-workspace NetworkBlocker already owns) and relies on a preload script
// for cosmetic filtering — but our tab views are sandboxed with no preload. So we
// use the engine's request matcher directly, folded into NetworkBlocker's single
// handler. That gives network-level ad/tracker blocking (the impactful part);
// cosmetic element-hiding is out of scope for the no-preload tab architecture.
//
// The prebuilt ads+tracking lists load once at startup; if that fails (offline),
// blocking simply stays disabled — never fatal.

let engine: ElectronBlocker | null = null

/** Load the blocklists (async). Call once after app ready; safe to not await. */
export function initAdblock(): void {
  ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
    .then((b) => {
      engine = b
    })
    .catch((err) => {
      console.error('[adblock] initialization failed; ad blocking disabled:', err)
      engine = null
    })
}

/** Whether a request is a known ad/tracker that should be cancelled. */
export function isAdOrTracker(details: OnBeforeRequestListenerDetails): boolean {
  if (!engine) return false
  try {
    return engine.match(fromElectronDetails(details)).match
  } catch {
    return false
  }
}
