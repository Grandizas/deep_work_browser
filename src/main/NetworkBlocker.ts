import { session } from 'electron'
import { roleForUrl } from './blocking'

/**
 * Network-layer blocking (Layer 1) for one workspace session. Cancels requests
 * to distraction sites at the sub-resource level — embeds, iframes, trackers,
 * redirect targets — so distraction content can't sneak in on an allowed page.
 *
 * Top-level (main-frame) navigations are intentionally left alone: those are
 * handled by Layer 2, which redirects them to the interstitial "speed bump"
 * rather than silently failing the load. Distractions are always blocked here
 * regardless of focus state (the focus-mode "allow only approved" restriction is
 * a navigation-level concept, applying it to sub-resources would break pages).
 */
export class NetworkBlocker {
  constructor(
    private readonly partition: string,
    private readonly workspaceId: string
  ) {}

  attach(): void {
    const ses = session.fromPartition(this.partition)
    ses.webRequest.onBeforeRequest((details, callback) => {
      if (details.resourceType === 'mainFrame') {
        callback({})
        return
      }
      const blocked = roleForUrl(details.url, this.workspaceId) === 'distraction'
      callback({ cancel: blocked })
    })
  }

  detach(): void {
    session.fromPartition(this.partition).webRequest.onBeforeRequest(null)
  }
}
