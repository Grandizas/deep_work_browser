import Store from 'electron-store'
import type { RolesConfig } from '../shared/types'

function emptyRoles(): RolesConfig {
  return { essential: [], reference: [], distractions: [] }
}

// Sensible out-of-box distractions so the blocking engine is useful before the
// user configures anything. Essential/reference are user-specific, so empty.
const DEFAULT_GLOBAL: RolesConfig = {
  essential: [],
  reference: [],
  distractions: [
    'reddit.com',
    'youtube.com',
    'x.com',
    'twitter.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com'
  ]
}

interface RolesSchema {
  // The baseline classification applied in every workspace.
  global: RolesConfig
  // Per-workspace additions, keyed by workspace id (e.g. reddit as reference in a
  // social-media workspace). Merge/precedence is resolved by the blocking engine.
  perWorkspace: Record<string, RolesConfig>
}

let store: Store<RolesSchema> | null = null
function s(): Store<RolesSchema> {
  if (!store) {
    store = new Store<RolesSchema>({ name: 'roles' })
    if (!store.has('global')) store.set('global', DEFAULT_GLOBAL)
    if (!store.has('perWorkspace')) store.set('perWorkspace', {})
  }
  return store
}

/** Persisted website-roles facade (roles.json). */
export const roles = {
  /** Materialize the store (seeds defaults on first run). Call after app ready. */
  init(): void {
    s()
  },
  getGlobal(): RolesConfig {
    return s().get('global')
  },
  setGlobal(config: RolesConfig): void {
    s().set('global', config)
  },
  getWorkspaceOverrides(workspaceId: string): RolesConfig {
    return s().get('perWorkspace')[workspaceId] ?? emptyRoles()
  },
  setWorkspaceOverrides(workspaceId: string, config: RolesConfig): void {
    const map = s().get('perWorkspace')
    map[workspaceId] = config
    s().set('perWorkspace', map)
  },
  /**
   * Effective roles for a workspace: the global lists plus the workspace's own
   * additions. Role-precedence (e.g. a workspace override reclassifying a global
   * distraction) is applied by the blocking engine, not here.
   */
  getEffective(workspaceId: string): RolesConfig {
    const g = this.getGlobal()
    const o = this.getWorkspaceOverrides(workspaceId)
    return {
      essential: [...g.essential, ...o.essential],
      reference: [...g.reference, ...o.reference],
      distractions: [...g.distractions, ...o.distractions]
    }
  }
}
