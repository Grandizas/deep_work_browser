<script setup lang="ts">
import { computed } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const info = computed(() => store.resume)
const accent = computed(() => info.value?.workspace.themeColor ?? '#818cf8')

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// mm:ss + label for the paused/running timer pill.
const timer = computed(() => {
  const f = info.value?.focus
  if (!f) return null
  const total = Math.round(f.remainingMs / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  const label = f.state === 'break' ? 'Break' : f.paused ? 'Focus paused' : 'Focus'
  return `${label} · ${mm}:${ss} left`
})
</script>

<template>
  <div class="resume" :style="{ '--a': accent }">
    <template v-if="info">
      <!-- Brand lockup -->
      <div class="brand">
        <span class="mark">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M3 13c2.5-5 5.5 5 9 0s6.5-5 9 0" /></svg>
        </span>
        <span class="word">Forge</span>
      </div>

      <h1 class="prompt">Continue where you left off?</h1>

      <!-- Resume card -->
      <div class="card">
        <span class="corner-dot" />
        <span class="tile">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="info.workspace.id === 'coding'">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </template>
            <template v-else-if="info.workspace.id === 'learning'">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </template>
            <template v-else-if="info.workspace.id === 'writing'">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
            </template>
            <template v-else-if="info.workspace.id === 'design'">
              <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="12" r="2" /><circle cx="12" cy="18.5" r="2.2" /><path d="M6.5 14v2.5A2 2 0 0 0 9 18" />
            </template>
            <template v-else-if="info.workspace.id === 'finance'">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </template>
            <template v-else-if="info.workspace.id === 'personal'">
              <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" />
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="9" />
            </template>
          </svg>
        </span>

        <span class="name">{{ info.workspace.name }}</span>

        <div class="meta">
          <span>{{ plural(info.tabCount, 'tab') }}</span>
          <span class="sep">•</span>
          <span>{{ plural(info.notesCount, 'note') }}</span>
        </div>

        <div v-if="timer" class="timer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>
          {{ timer }}
        </div>
      </div>

      <div class="actions">
        <button class="btn-primary" @click="store.resumeSession()">Continue</button>
        <button class="btn-ghost" @click="store.dismissResume()">Choose a different workspace</button>
      </div>
    </template>

    <template v-else>
      <h1 class="prompt">Welcome back</h1>
      <button class="btn-primary" style="width: auto; padding: 0 34px" @click="store.dismissResume()">
        Choose a workspace
      </button>
    </template>
  </div>
</template>

<style scoped>
.resume {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30px;
  background: var(--flow-app);
  background-image: radial-gradient(
    circle at 50% 12%,
    color-mix(in srgb, var(--a) 10%, transparent),
    transparent 46%
  );
  user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  opacity: 0.9;
}
.mark {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: grid;
  place-items: center;
  box-shadow: 0 4px 12px rgba(129, 140, 248, 0.4);
}
.word {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--flow-text-2);
}

.prompt {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 44px;
  letter-spacing: -0.01em;
  color: var(--flow-text);
  white-space: nowrap;
}

.card {
  position: relative;
  width: 320px;
  padding: 26px 24px 24px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--a) 32%, var(--flow-line-2));
  background: color-mix(in srgb, var(--a) 8%, var(--flow-panel));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}
.corner-dot {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--a);
  box-shadow: 0 0 12px var(--a);
}
.tile {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--a) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--a) 30%, transparent);
}
.name {
  font-size: 18px;
  font-weight: 600;
  color: var(--flow-text);
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--flow-text-3);
  font-variant-numeric: tabular-nums;
}
.sep {
  opacity: 0.5;
}
.timer {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--a);
  background: color-mix(in srgb, var(--a) 14%, transparent);
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 320px;
}
.btn-primary {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: default;
  box-shadow: 0 6px 20px rgba(129, 140, 248, 0.35);
}
.btn-primary:hover {
  filter: brightness(1.08);
}
.btn-ghost {
  border: none;
  background: transparent;
  color: var(--flow-text-3);
  font-size: 13px;
  font-weight: 500;
  cursor: default;
}
.btn-ghost:hover {
  color: var(--flow-text);
}
</style>
