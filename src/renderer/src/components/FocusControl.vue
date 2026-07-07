<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

// Tick a local clock every second while a session is active so the countdown
// updates. Main only pushes on phase changes — the time comes from `endsAt`.
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined

watch(
  () => store.focus.state,
  (state) => {
    clearInterval(ticker)
    if (state !== 'idle') {
      now.value = Date.now()
      ticker = setInterval(() => (now.value = Date.now()), 1000)
    }
  },
  { immediate: true }
)
onUnmounted(() => clearInterval(ticker))

const countdown = computed(() => {
  const endsAt = store.focus.endsAt
  const totalSec = endsAt ? Math.max(0, Math.ceil((endsAt - now.value) / 1000)) : 0
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <!-- Idle: start a focus session (duration presets in a native menu). -->
  <button
    v-if="store.focus.state === 'idle'"
    class="focus-btn"
    title="Start a focus session"
    @click="store.openFocusMenu()"
  >
    <span class="dot" />
    Focus
  </button>

  <!-- Active: a subtle, always-visible countdown. -->
  <div
    v-else
    class="focus-active"
    :class="store.focus.state"
    :title="store.focus.state === 'focus' ? 'Focus session' : 'Break'"
  >
    <span class="glyph">{{ store.focus.state === 'focus' ? '●' : '☕' }}</span>
    <span class="time">{{ countdown }}</span>
  </div>
</template>

<style scoped>
.focus-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  cursor: default;
}
.focus-btn:hover {
  background: var(--color-background-mute);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.focus-active {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.focus-active.break {
  background: color-mix(in srgb, #22c55e 20%, transparent);
}
.focus-active .glyph {
  font-size: 10px;
  color: var(--accent);
}
.focus-active.break .glyph {
  font-size: 12px;
  color: inherit;
}
</style>
