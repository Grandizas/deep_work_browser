import { session } from 'electron'
import { roleForUrl, sameSite } from './blocking'

/**
 * Network-layer blocking (Layer 1) for one workspace session. Cancels requests
 * to distraction sites at the sub-resource level — embeds, iframes, trackers,
 * redirect targets — so distraction content can't sneak in on an allowed page.
 *
 * Top-level (main-frame) navigations are intentionally left alone: those are
 * handled by Layer 2, which redirects them to the interstitial "speed bump"
 * rather than silently failing the load.
 *
 * Only *cross-site* distraction requests are cancelled — a reddit embed on a work
 * page is blocked, but reddit's own resources when you're actually on reddit
 * (having passed the interstitial / Continue Anyway) are allowed, so the page
 * isn't broken. Focus-mode's "allow only approved" is a navigation-level concept
 * enforced by Layer 2; applying it to sub-resources would break legitimate pages.
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
      if (roleForUrl(details.url, this.workspaceId) !== 'distraction') {
        callback({})
        return
      }
      // Distraction sub-resource: allow if first-party (top page is this same
      // site), block if it's a cross-site embed.
      let topUrl = ''
      try {
        topUrl = details.frame?.top?.url ?? ''
      } catch {
        topUrl = ''
      }
      callback({ cancel: !sameSite(topUrl, details.url) })
    })
  }

  detach(): void {
    session.fromPartition(this.partition).webRequest.onBeforeRequest(null)
  }
}
