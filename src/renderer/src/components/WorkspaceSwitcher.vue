<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
</script>

<template>
  <button
    class="switcher"
    :title="`Workspace: ${store.activeWorkspace?.name ?? ''}`"
    @click="store.openWorkspaceMenu()"
  >
    <span class="dot" :style="{ background: store.activeWorkspace?.themeColor }" />
    <span class="emoji">{{ store.activeWorkspace?.emoji }}</span>
    <span class="name">{{ store.activeWorkspace?.name ?? 'Workspace' }}</span>
    <span class="chev">▾</span>
  </button>
</template>

<style scoped>
.switcher {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  margin: 0 6px 3px 2px;
  padding: 0 8px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  background: var(--color-background-mute);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  cursor: default;
}
.switcher:hover {
  background: var(--color-background);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.emoji {
  font-size: 13px;
  line-height: 1;
}

.name {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chev {
  font-size: 9px;
  color: var(--ev-c-text-3);
}
</style>
