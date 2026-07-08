<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
</script>

<template>
  <div class="tabbar">
    <div class="pill" role="tablist" aria-label="Tabs">
      <div
        v-for="tab in store.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === store.activeTabId }"
        role="tab"
        tabindex="0"
        :aria-selected="tab.id === store.activeTabId"
        :title="tab.title || tab.url"
        @click="store.activateTab(tab.id)"
        @keydown.enter="store.activateTab(tab.id)"
        @keydown.space.prevent="store.activateTab(tab.id)"
      >
        <img v-if="tab.favicon" class="fav" :src="tab.favicon" alt="" />
        <span v-else class="fav dot" />
        <span class="label">{{ tab.title || tab.url || 'New Tab' }}</span>
        <button
          v-if="tab.id === store.activeTabId"
          class="close"
          aria-label="Close tab"
          title="Close tab"
          @click.stop="store.closeTab(tab.id)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <button class="newtab" aria-label="New tab" title="New tab" @click="store.newTab()">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tabbar {
  height: 52px;
  flex: 0 0 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
}
.pill {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 5px;
  border-radius: 14px;
  background: rgba(14, 15, 20, 0.72);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid var(--flow-line-2);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45);
  overflow-x: auto;
  scrollbar-width: none;
}
.pill::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  cursor: default;
  flex: 0 0 auto;
}
.tab:hover {
  background: rgba(255, 255, 255, 0.04);
}
.tab.active {
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  padding: 5px 11px;
}
.fav {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
}
.fav.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--flow-text-3);
}
.tab.active .fav.dot {
  background: var(--accent);
}
.label {
  font-size: 12.5px;
  color: var(--flow-text-2);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab.active .label {
  color: #eceefb;
  font-weight: 600;
}
.close {
  display: grid;
  place-items: center;
  color: #8b93d6;
  cursor: default;
}
.close:hover {
  color: #eceefb;
}
.newtab {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--flow-text-3);
  cursor: default;
}
.newtab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--flow-text);
}
</style>
