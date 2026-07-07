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

  // Path-prefix match, e.g. pattern `youtube.com/feed` blocks `/feed/subscriptions`.
  return parsed.pathname.startsWith('/' + patPath.join('/'))
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
  return role === 'distraction' ? 'block' : 'allow'
}
