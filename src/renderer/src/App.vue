<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useBrowserStore } from './stores/browser'

const store = useBrowserStore()
let unsubscribe: (() => void) | undefined

onMounted(() => {
  // Mirror every state push from main, then ask for the initial snapshot.
  unsubscribe = window.api.onState((state) => store.apply(state))
  window.api.send('ui:ready')
})

onUnmounted(() => unsubscribe?.())
</script>

<template>
  <div id="chrome">
    <span class="brand">deep_work</span>
    <span class="url">{{ store.activeTab?.url || 'about:blank' }}</span>
    <span v-if="store.activeTab?.isLoading" class="loading">loading…</span>
  </div>
</template>

<style scoped>
#chrome {
  height: 100vh;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.brand {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.02em;
}

.url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--ev-c-text-2);
  background: var(--color-background-mute);
  padding: 6px 12px;
  border-radius: 6px;
}

.loading {
  font-size: 12px;
  color: var(--ev-c-text-3);
}
</style>
