import type { PaletteResult, TabState, WorkspaceSummary, RolesConfig } from '../shared/types'
import { searchHistory } from './history'

interface PaletteContext {
  tabs: TabState[]
  activeTabId: string | null
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  roles: RolesConfig
}

/** Subsequence/substring match — every query char appears in order in `text`. */
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true
  if (text.includes(query)) return true
  let i = 0
  for (const ch of text) {
    if (ch === query[i]) i++
    if (i === query.length) return true
  }
  return false
}

/**
 * Build the ranked command-palette results for a query:
 * parameterized commands first (`timer 30`, `block youtube`), then matching
 * static commands, then a fuzzy site jump over open tabs, role sites, and history.
 */
export function computePaletteResults(query: string, ctx: PaletteContext): PaletteResult[] {
  const q = query.trim().toLowerCase()
  const out: PaletteResult[] = []

  // --- Parameterized commands ---
  const timer = q.match(/^timer\s+(\d+)$/)
  if (timer) {
    const min = parseInt(timer[1], 10)
    if (min > 0) {
      out.push({
        id: `timer-${min}`,
        icon: '⏱',
        title: `Start a ${min}-minute focus session`,
        cmd: 'focus:start',
        payload: { minutes: min }
      })
    }
  }
  const block = q.match(/^block\s+(.+)$/)
  if (block) {
    const site = block[1].trim()
    out.push({
      id: `block-${site}`,
      icon: '🚫',
      title: `Block ${site}`,
      subtitle: 'Add to distractions',
      cmd: 'roles:add',
      payload: { role: 'distractions', pattern: site }
    })
  }

  // `new <workspace> session` — switch to a workspace and start a focus session.
  const session = q.match(/^new\s+(.+?)(?:\s+session)?$/)
  if (session) {
    const nameQ = session[1].trim()
    for (const w of ctx.workspaces) {
      if (fuzzyMatch(nameQ, w.name.toLowerCase())) {
        out.push({
          id: `session-${w.id}`,
          icon: w.emoji,
          title: `New ${w.name} session`,
          subtitle: 'Switch + start a 25-minute focus session',
          cmd: 'workspace:session',
          payload: { id: w.id, minutes: 25 }
        })
      }
    }
  }

  // --- Static commands ---
  const statics: PaletteResult[] = [
    { id: 'new-tab', icon: '➕', title: 'New tab', cmd: 'tab:new' },
    {
      id: 'focus-25',
      icon: '⏱',
      title: 'Start focus — 25 minutes',
      cmd: 'focus:start',
      payload: { minutes: 25 }
    },
    {
      id: 'focus-50',
      icon: '⏱',
      title: 'Start focus — 50 minutes',
      cmd: 'focus:start',
      payload: { minutes: 50 }
    },
    {
      id: 'focus-90',
      icon: '⏱',
      title: 'Start focus — 90 minutes',
      cmd: 'focus:start',
      payload: { minutes: 90 }
    },
    {
      id: 'settings',
      icon: '⚙',
      title: 'Website roles',
      subtitle: 'Settings',
      cmd: 'settings:open'
    }
  ]
  for (const w of ctx.workspaces) {
    if (w.id === ctx.activeWorkspaceId) continue
    statics.push({
      id: `ws-${w.id}`,
      icon: w.emoji,
      title: `Switch to ${w.name}`,
      cmd: 'workspace:switch',
      payload: { id: w.id }
    })
  }
  for (const s of statics) {
    if (
      fuzzyMatch(q, s.title.toLowerCase()) ||
      (s.subtitle && fuzzyMatch(q, s.subtitle.toLowerCase()))
    ) {
      out.push(s)
    }
  }

  // --- Fuzzy site jump (needs a query) ---
  if (q) {
    for (const t of ctx.tabs) {
      if (t.id === ctx.activeTabId) continue
      if (fuzzyMatch(q, `${t.title} ${t.url}`.toLowerCase())) {
        out.push({
          id: `tab-${t.id}`,
          icon: '📑',
          title: t.title || t.url,
          subtitle: 'Switch to tab',
          cmd: 'tab:activate',
          payload: { id: t.id }
        })
      }
    }
    const patterns = [...ctx.roles.essential, ...ctx.roles.reference, ...ctx.roles.distractions]
    for (const p of patterns) {
      if (fuzzyMatch(q, p.toLowerCase())) {
        out.push({
          id: `site-${p}`,
          icon: '🔖',
          title: `Go to ${p}`,
          cmd: 'tab:navigate',
          payload: { url: `https://${p}` }
        })
      }
    }
    for (const h of searchHistory(q, 6)) {
      out.push({
        id: `hist-${h.url}`,
        icon: '🕘',
        title: h.title || h.url,
        subtitle: h.url,
        cmd: 'tab:navigate',
        payload: { url: h.url }
      })
    }
  }

  const seen = new Set<string>()
  return out
    .filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
    .slice(0, 12)
}
