import type { RolesConfig } from '../shared/types'
import { roles } from './roles'

export type FocusState = 'idle' | 'focus' | 'break'
export type SiteRole = 'essential' | 'reference' | 'distraction' | 'unknown'

/**
 * Does a role pattern match the URL? A pattern is a host (`reddit.com`, matching
 * that host and its subdomains) with an optional path prefix (`youtube.com/watch`).
 */
export function matchesPattern(url: string, pattern: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname.replace(/^www\./, '')
  const [patHostRaw, ...patPath] = pattern.trim().toLowerCase().split('/')
  const patHost = patHostRaw.replace(/^www\./, '')
  if (!patHost) return false

  const hostMatches = host === patHost || host.endsWith('.' + patHost)
  if (!hostMatches) return false
  if (patPath.length === 0) return true

  // Path-prefix match on a segment boundary, so `youtube.com/feed` matches
  // `/feed` and `/feed/subscriptions` but not `/feedback`.
  return pathHasPrefix(parsed.pathname, '/' + patPath.join('/'))
}

/** True if `pathname` equals `prefix` or continues past it on a `/` boundary. */
function pathHasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

function firstMatch(url: string, config: RolesConfig): SiteRole | null {
  if (config.essential.some((p) => matchesPattern(url, p))) return 'essential'
  if (config.reference.some((p) => matchesPattern(url, p))) return 'reference'
  if (config.distractions.some((p) => matchesPattern(url, p))) return 'distraction'
  return null
}

/**
 * Classify a URL for a workspace. Workspace overrides win over the global list,
 * so a site can be reclassified per workspace (e.g. reddit as reference).
 */
export function roleForUrl(url: string, workspaceId: string): SiteRole {
  const wsRole = firstMatch(url, roles.getWorkspaceOverrides(workspaceId))
  if (wsRole) return wsRole
  return firstMatch(url, roles.getGlobal()) ?? 'unknown'
}

/** Internal / non-web URLs (chrome pages, about:blank, data:, file:) are always allowed. */
function isInternal(url: string): boolean {
  return !/^https?:\/\//i.test(url)
}

// Path-based exceptions: sites that are distractions overall but have specific
// paths worth allowing. YouTube's homepage and /feed are the doomscroll; a direct
// /watch video is an intentional visit. Only applies in idle mode (see below).
const SPECIAL_ALLOW: { host: string; allowPaths: string[] }[] = [
  { host: 'youtube.com', allowPaths: ['/watch'] }
]

function specialCaseAllows(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  const host = u.hostname.replace(/^www\./, '')
  for (const rule of SPECIAL_ALLOW) {
    if (host === rule.host || host.endsWith('.' + rule.host)) {
      return rule.allowPaths.some((p) => pathHasPrefix(u.pathname, p))
    }
  }
  return false
}

/**
 * Approximate registrable domain (last two labels) of a URL, e.g.
 * `www.reddit.com` → `reddit.com`. Used to treat a site's own resources and
 * redirects as first-party. Not a full public-suffix implementation.
 */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.split('.').slice(-2).join('.')
  } catch {
    return ''
  }
}

export function sameSite(a: string, b: string): boolean {
  const sa = siteOf(a)
  return sa !== '' && sa === siteOf(b)
}

/**
 * Decide allow/block for a navigation given the active workspace and focus state:
 * - break: everything allowed (the reward),
 * - focus: only Essential/Reference (approved) allowed,
 * - idle: Distractions blocked, everything else allowed.
 */
export function decideNavigation(
  url: string,
  workspaceId: string,
  focusState: FocusState
): 'allow' | 'block' {
  if (isInternal(url)) return 'allow'
  if (focusState === 'break') return 'allow'

  const role = roleForUrl(url, workspaceId)
  if (focusState === 'focus') {
    return role === 'essential' || role === 'reference' ? 'allow' : 'block'
  }
  // idle: block distractions, but honour path-based exceptions (e.g. YouTube /watch).
  if (role === 'distraction') {
    return specialCaseAllows(url) ? 'allow' : 'block'
  }
  return 'allow'
}
