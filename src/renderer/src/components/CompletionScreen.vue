<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

// Live break countdown, computed from endsAt (main pushes only on phase change).
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 1000)
})
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
  <div class="completion">
    <div class="glyph">🎉</div>
    <h1>Focus session complete</h1>
    <p class="sub">Nice work. Take a break — everything's unlocked.</p>

    <div class="break">
      <span class="break-label">Break ends in</span>
      <span class="break-time">{{ countdown }}</span>
    </div>

    <button class="browse" @click="store.dismissCompletion()">Start browsing</button>
  </div>
</template>

<style scoped>
.completion {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--color-background);
  color: var(--color-text);
  user-select: none;
}

.glyph {
  font-size: 56px;
  margin-bottom: 8px;
}
h1 {
  font-size: 26px;
  font-weight: 600;
}
.sub {
  font-size: 14px;
  color: var(--ev-c-text-2);
}

.break {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin: 20px 0 8px;
  padding: 16px 32px;
  border-radius: 14px;
  background: color-mix(in srgb, #22c55e 12%, var(--color-background-soft));
}
.break-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ev-c-text-3);
}
.break-time {
  font-size: 34px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #22c55e;
}

.browse {
  margin-top: 12px;
  border: none;
  border-radius: 10px;
  background: var(--ev-c-gray-3);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  padding: 10px 22px;
  cursor: default;
}
.browse:hover {
  background: var(--ev-c-gray-2);
}
</style>
