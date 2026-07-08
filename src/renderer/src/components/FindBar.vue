<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const query = ref('')
const input = ref<HTMLInputElement | null>(null)

const label = computed(() => {
  if (!query.value) return ''
  const { current, total } = store.findResult
  return total > 0 ? `${current}/${total}` : 'No results'
})
const noMatches = computed(() => query.value.length > 0 && store.findResult.total === 0)

// Search as you type (lightly debounced so fast typing doesn't spam findInPage).
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => store.findQuery(q), 150)
})

function enter(e: KeyboardEvent): void {
  store.findNext(!e.shiftKey)
}

onMounted(() => {
  input.value?.focus()
})
// Cancel a pending search so closing the bar (Esc) can't re-highlight the page
// after it's gone. Main clears highlights via stopFindInPage on find:close.
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="findbar">
    <input
      ref="input"
      v-model="query"
      class="find-input"
      :class="{ 'no-match': noMatches }"
      type="text"
      spellcheck="false"
      placeholder="Find in page"
      @keydown.enter.prevent="enter"
      @keydown.esc.prevent="store.closeFind()"
    />
    <span class="count">{{ label }}</span>
    <button class="fbtn" title="Previous (Shift+Enter)" @click="store.findNext(false)">‹</button>
    <button class="fbtn" title="Next (Enter)" @click="store.findNext(true)">›</button>
    <button class="fbtn close" title="Close (Esc)" @click="store.closeFind()">✕</button>
  </div>
</template>

<style scoped>
.findbar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 12px;
  border-top: 1px solid var(--ev-c-gray-3);
  background: transparent;
}
.find-input {
  width: 240px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}
.find-input:focus {
  border-color: var(--accent, var(--ev-c-gray-1));
}
.find-input.no-match {
  border-color: #e5484d;
}
.count {
  min-width: 54px;
  font-size: 12px;
  color: var(--ev-c-text-3);
  font-variant-numeric: tabular-nums;
}
.fbtn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 16px;
  line-height: 1;
  cursor: default;
}
.fbtn:hover {
  background: var(--color-background-mute);
}
.close {
  margin-left: auto;
  font-size: 12px;
  color: var(--ev-c-text-3);
}
</style>
