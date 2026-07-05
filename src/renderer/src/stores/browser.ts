import { defineStore } from 'pinia'
import type { BrowserState } from '../../../shared/types'

// A dumb mirror of the main process's authoritative BrowserState. The renderer
// never mutates fields directly — it only applies whole snapshots pushed by main.
export const useBrowserStore = defineStore('browser', {
  state: (): BrowserState => ({
    activeTab: null
  }),
  actions: {
    apply(next: BrowserState): void {
      this.activeTab = next.activeTab
    }
  }
})
