<script setup lang="ts">
import { computed } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

// Join capability names into a readable phrase: "camera and microphone".
const capabilities = computed(() => {
  const t = store.permissionRequest?.types ?? []
  if (t.length <= 1) return t[0] ?? ''
  return `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`
})
</script>

<template>
  <div v-if="store.permissionRequest" class="prompt">
    <span class="icon">🔒</span>
    <span class="text">
      <strong>{{ store.permissionRequest.origin }}</strong>
      wants to use your <strong>{{ capabilities }}</strong>
    </span>
    <div class="actions">
      <button class="block" @click="store.resolvePermission(store.permissionRequest.id, false)">
        Block
      </button>
      <button class="allow" @click="store.resolvePermission(store.permissionRequest.id, true)">
        Allow
      </button>
    </div>
  </div>
</template>

<style scoped>
.prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 12px;
  border-top: 1px solid var(--ev-c-gray-3);
  background: var(--color-background-soft);
}

.icon {
  flex-shrink: 0;
  font-size: 14px;
}

.text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text);
}

.actions {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
}

button {
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: default;
}
.block {
  background: var(--ev-c-gray-3);
  color: var(--color-text);
}
.block:hover {
  background: var(--ev-c-gray-2);
}
.allow {
  background: #4f8cff;
  color: #fff;
}
.allow:hover {
  background: #3a78f0;
}
</style>
