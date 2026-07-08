<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const query = ref('')
const input = ref<HTMLInputElement | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => store.queryHistory(q), 150)
})

function open(url: string): void {
  store.navigate(url)
  store.closeHistory()
}

function when(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

onMounted(() => input.value?.focus())
</script>

<template>
  <div class="history">
    <header class="head">
      <h1>History</h1>
      <button class="close" aria-label="Close" title="Close (Esc)" @click="store.closeHistory()">
        ✕
      </button>
    </header>
    <input
      ref="input"
      v-model="query"
      class="search"
      type="text"
      spellcheck="false"
      placeholder="Search this workspace's history…"
      @keydown.esc="store.closeHistory()"
    />
    <ul v-if="store.historyResults.length" class="list">
      <li
        v-for="h in store.historyResults"
        :key="h.url"
        class="row"
        :title="h.url"
        @click="open(h.url)"
      >
        <span class="text">
          <span class="title">{{ h.title || h.url }}</span>
          <span class="url">{{ h.url }}</span>
        </span>
        <span class="time">{{ when(h.visitedAt) }}</span>
      </li>
    </ul>
    <p v-else class="empty">{{ query ? 'No matching history' : 'No history yet' }}</p>
  </div>
</template>

<style scoped>
.history {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  padding: 0 clamp(16px, 8vw, 120px);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 0 12px;
}
h1 {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}
.close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ev-c-text-3);
  font-size: 14px;
  cursor: default;
}
.close:hover {
  background: var(--color-background-mute);
  color: var(--color-text);
}
.search {
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 10px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  margin-bottom: 12px;
}
.search:focus {
  border-color: var(--accent, var(--ev-c-gray-1));
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 0 24px;
  overflow-y: auto;
}
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: default;
}
.row:hover {
  background: var(--color-background-mute);
}
.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.title {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.url {
  font-size: 11px;
  color: var(--ev-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ev-c-text-3);
  font-variant-numeric: tabular-nums;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--ev-c-text-3);
  font-size: 13px;
}
</style>
