<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
</script>

<template>
  <div class="tabbar" role="tablist" aria-label="Tabs">
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
      <img v-if="tab.favicon" class="favicon" :src="tab.favicon" alt="" />
      <span v-else class="favicon placeholder" />
      <span class="label">{{ tab.title || tab.url || 'New Tab' }}</span>
      <button
        class="close"
        aria-label="Close tab"
        title="Close tab"
        @click.stop="store.closeTab(tab.id)"
      >
        ×
      </button>
    </div>
    <button class="newtab" aria-label="New tab" title="New tab" @click="store.newTab()">+</button>
  </div>
</template>

<style scoped>
.tabbar {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 40px;
  padding: 6px 8px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabbar::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
  max-width: 200px;
  height: 34px;
  padding: 0 8px 0 10px;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--ev-c-text-2);
  cursor: default;
  font-size: 12px;
  flex: 0 1 auto;
}
.tab:hover {
  background: var(--color-background-mute);
}
.tab.active {
  background: var(--color-background);
  color: var(--color-text);
}
.tab:focus-visible {
  outline: 2px solid var(--ev-c-gray-1);
  outline-offset: -2px;
}

.favicon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 3px;
}
.favicon.placeholder {
  background: var(--ev-c-gray-2);
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: default;
  opacity: 0.6;
}
.close:hover {
  background: var(--ev-c-gray-2);
  opacity: 1;
}

.newtab {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-bottom: 3px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 18px;
  line-height: 1;
  cursor: default;
}
.newtab:hover {
  background: var(--color-background-mute);
  color: var(--color-text);
}
</style>
