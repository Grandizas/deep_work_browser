import Store from 'electron-store'
import type { Workspace } from '../shared/types'

/** Build a default workspace. Partition follows the `persist:ws-<id>` convention. */
function makeDefault(id: string, name: string, emoji: string, themeColor: string): Workspace {
  return {
    id,
    name,
    emoji,
    themeColor,
    partition: `persist:ws-${id}`,
    tabIds: [],
    pinnedSites: []
  }
}

// The six workspaces the browser ships with (architectural decision: reduce
// decisions — a fixed, opinionated set rather than an empty "create one" screen).
const DEFAULT_WORKSPACES: Workspace[] = [
  makeDefault('coding', 'Coding', '💻', '#4f8cff'),
  makeDefault('learning', 'Learning', '📚', '#22c55e'),
  makeDefault('writing', 'Writing', '✍️', '#f59e0b'),
  makeDefault('design', 'Design', '🎨', '#ec4899'),
  makeDefault('finance', 'Finance', '💰', '#14b8a6'),
  makeDefault('personal', 'Personal', '🏠', '#a855f7')
]

interface WorkspacesSchema {
  workspaces: Workspace[]
}

// Lazily constructed after app ready (electron-store reads the userData path in
// its constructor). Stored in its own human-readable workspaces.json.
let store: Store<WorkspacesSchema> | null = null
function s(): Store<WorkspacesSchema> {
  if (!store) {
    store = new Store<WorkspacesSchema>({ name: 'workspaces' })
    // Seed the defaults on first run; never clobber the user's later edits.
    if (!store.has('workspaces')) store.set('workspaces', DEFAULT_WORKSPACES)
  }
  return store
}

/** Persisted workspace model facade. Switching/active state comes in later steps. */
export const workspaces = {
  /** Materializes the store (seeds defaults on first run). Call after app ready. */
  init(): void {
    s()
  },
  getAll(): Workspace[] {
    return s().get('workspaces')
  },
  get(id: string): Workspace | null {
    return (
      s()
        .get('workspaces')
        .find((w) => w.id === id) ?? null
    )
  },
  saveAll(list: Workspace[]): void {
    s().set('workspaces', list)
  },
  update(id: string, patch: Partial<Omit<Workspace, 'id'>>): void {
    const list = s()
      .get('workspaces')
      .map((w) => (w.id === id ? { ...w, ...patch } : w))
    s().set('workspaces', list)
  }
}
