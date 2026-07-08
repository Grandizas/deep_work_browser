<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const query = ref('')
const input = ref<HTMLInputElement | null>(null)
const selected = ref(0)

const results = computed(() => store.paletteResults)

onMounted(() => {
  input.value?.focus()
  store.queryPalette('')
})

// Ask main to recompute on each keystroke; reset the highlight.
watch(query, (q) => {
  selected.value = 0
  store.queryPalette(q)
})

// Keep the highlight in range as results change.
watch(results, (r) => {
  if (selected.value >= r.length) selected.value = Math.max(0, r.length - 1)
})

function move(delta: number): void {
  const n = results.value.length
  if (n === 0) return
  selected.value = (selected.value + delta + n) % n
}
function run(index: number): void {
  const r = results.value[index]
  if (r) store.runResult(r)
}
</script>

<template>
  <div class="overlay" @click.self="store.closePalette()">
    <div class="palette">
      <input
        ref="input"
        v-model="query"
        class="query"
        type="text"
        spellcheck="false"
        autocomplete="off"
        placeholder="Type a command or search…"
        @keydown.esc="store.closePalette()"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="run(selected)"
      />
      <ul v-if="results.length" class="results">
        <li
          v-for="(r, i) in results"
          :key="r.id"
          class="result"
          :class="{ active: i === selected }"
          @click="run(i)"
          @mousemove="selected = i"
        >
          <span class="icon">{{ r.icon }}</span>
          <span class="text">
            <span class="title">{{ r.title }}</span>
            <span v-if="r.subtitle" class="subtitle">{{ r.subtitle }}</span>
          </span>
        </li>
      </ul>
      <p v-else class="empty">No matches</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 14vh;
  background: rgba(6, 7, 10, 0.55);
  user-select: none;
}

.palette {
  width: 640px;
  max-width: 92vw;
  background: rgba(17, 18, 25, 0.92);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid var(--flow-line-2);
  border-radius: 16px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.query {
  width: 100%;
  height: 54px;
  padding: 0 20px;
  border: none;
  background: transparent;
  color: var(--flow-text);
  font-size: 16px;
  outline: none;
}
.query::placeholder {
  color: var(--flow-text-3);
}

.results {
  max-height: 52vh;
  overflow-y: auto;
  border-top: 1px solid var(--flow-line);
  padding: 6px;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  cursor: default;
}
.result.active {
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  padding: 8px 11px;
}
.icon {
  width: 20px;
  text-align: center;
  font-size: 14px;
  flex-shrink: 0;
}
.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.title {
  font-size: 13px;
  color: var(--flow-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result.active .title {
  color: #eceefb;
}
.subtitle {
  font-size: 11px;
  color: var(--flow-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  padding: 20px;
  font-size: 13px;
  color: var(--flow-text-3);
  text-align: center;
  border-top: 1px solid var(--flow-line);
}
</style>
