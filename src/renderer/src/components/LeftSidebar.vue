<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

const DAILY_GOAL_MIN = 300 // 5h focus goal
const focusPct = computed(() =>
  Math.min(100, Math.round((store.dailyFocusMinutes / DAILY_GOAL_MIN) * 100))
)
function hm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// Ticking countdown for the focus card (main only pushes on phase changes).
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
  const f = store.focus
  const sec = f.paused
    ? Math.ceil(f.remainingMs / 1000)
    : f.endsAt
      ? Math.max(0, Math.ceil((f.endsAt - now.value) / 1000))
      : 0
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
})
const isFocus = computed(() => store.focus.state !== 'idle')
</script>

<template>
  <aside class="left">
    <!-- Brand + palette -->
    <div class="brand">
      <div class="mark">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          stroke-width="2.4"
          stroke-linecap="round"
        >
          <path d="M3 13c2.5-5 5.5 5 9 0s6.5-5 9 0" />
        </svg>
      </div>
      <span class="word">Flow</span>
      <button class="kbd" title="Command palette (Ctrl+K)" @click="store.openPalette()">⌘K</button>
    </div>

    <!-- Workspaces -->
    <div class="section">
      <div class="label">Workspaces</div>
      <div class="ws-list">
        <button
          v-for="w in store.workspaces"
          :key="w.id"
          class="ws"
          :class="{ active: w.id === store.activeWorkspaceId }"
          :style="{ '--dot': w.themeColor }"
          @click="store.switchWorkspace(w.id)"
        >
          <span class="ws-dot" />
          <span class="ws-name">{{ w.name }}</span>
          <span v-if="store.workspaceTabCounts[w.id]" class="ws-count">{{
            store.workspaceTabCounts[w.id]
          }}</span>
        </button>
      </div>
    </div>

    <!-- Daily Focus -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">Daily Focus</span>
        <span class="pct tnum">{{ focusPct }}%</span>
      </div>
      <div class="bar"><div class="bar-fill" :style="{ width: focusPct + '%' }" /></div>
      <div class="sub tnum">{{ hm(store.dailyFocusMinutes) }} of {{ hm(DAILY_GOAL_MIN) }} goal</div>
    </div>

    <!-- Focus session -->
    <div class="card focus">
      <template v-if="isFocus">
        <div class="focus-top">
          <span class="live" />
          <span class="focus-label">{{
            store.focus.state === 'break' ? 'Break' : 'Focus session'
          }}</span>
        </div>
        <div class="focus-row">
          <span class="time tnum">{{ countdown }}</span>
          <button class="ctl" title="Pause / end" @click="store.openFocusControlMenu()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <rect x="7" y="5" width="3.5" height="14" rx="1" />
              <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <div class="focus-top">
          <span class="live idle" />
          <span class="focus-label">Start a focus session</span>
        </div>
        <div class="presets">
          <button v-for="m in [25, 50, 90]" :key="m" class="preset" @click="store.startFocus(m)">
            {{ m }}
          </button>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.left {
  width: 260px;
  flex: 0 0 260px;
  background: var(--flow-sidebar);
  border-right: 1px solid var(--flow-line);
  display: flex;
  flex-direction: column;
  padding: 16px 14px;
  gap: 18px;
  overflow-y: auto;
  scrollbar-width: none;
  user-select: none;
}
.left::-webkit-scrollbar {
  display: none;
}
.tnum {
  font-variant-numeric: tabular-nums;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
}
.mark {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: grid;
  place-items: center;
  box-shadow: 0 4px 12px rgba(129, 140, 248, 0.4);
}
.word {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.kbd {
  margin-left: auto;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--flow-panel);
  border: 1px solid var(--flow-line-2);
  color: var(--flow-text-3);
  font-size: 11px;
  font-weight: 600;
  cursor: default;
}
.kbd:hover {
  color: var(--flow-text-2);
}

.section .label,
.card-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--flow-text-4);
}
.section .label {
  padding: 0 8px 8px;
}

.ws-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ws {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: default;
}
.ws:hover {
  background: rgba(255, 255, 255, 0.04);
}
.ws.active {
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  padding: 8px 9px;
}
.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot, var(--accent));
}
.ws.active .ws-dot {
  box-shadow: 0 0 10px var(--dot, var(--accent));
}
.ws-name {
  flex: 1;
  font-size: 14px;
  color: var(--flow-text-2);
}
.ws.active .ws-name {
  color: var(--flow-text);
  font-weight: 600;
}
.ws-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--flow-text-4);
}
.ws.active .ws-count {
  color: var(--flow-text-2);
}

.card {
  background: var(--flow-panel);
  border: 1px solid var(--flow-line);
  border-radius: 14px;
  padding: 14px;
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 11px;
}
.pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-text);
}
.bar {
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transition: width 0.4s ease;
}
.sub {
  margin-top: 9px;
  font-size: 12px;
  color: var(--flow-text-3);
}

.focus {
  background: linear-gradient(160deg, #15161d, var(--flow-panel));
}
.focus-top {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
}
.live {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}
.live.idle {
  background: var(--flow-text-4);
  box-shadow: none;
}
.focus-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--flow-text-2);
}
.focus-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.time {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f2f3f7;
}
.ctl {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--accent);
  display: grid;
  place-items: center;
  box-shadow: 0 4px 14px rgba(129, 140, 248, 0.5);
  cursor: default;
}
.presets {
  display: flex;
  gap: 7px;
}
.preset {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-radius: 9px;
  background: var(--flow-panel-2);
  border: 1px solid var(--flow-line);
  color: var(--flow-text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: default;
}
.preset:hover {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-text);
}
</style>
