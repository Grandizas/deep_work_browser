<script setup lang="ts">
import { computed } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const info = computed(() => store.resume)

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// mm:ss from remaining milliseconds, for the paused/running timer chip.
const timerLabel = computed(() => {
  const f = info.value?.focus
  if (!f) return ''
  const total = Math.round(f.remainingMs / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  const kind = f.state === 'break' ? 'Break' : f.paused ? 'Focus paused' : 'Focus'
  return `${kind} · ${mm}:${ss} left`
})
</script>

<template>
  <div class="resume" :style="{ '--card-accent': info ? info.workspace.themeColor : '#4f8cff' }">
    <template v-if="info">
      <h1 class="prompt">Continue where you left off?</h1>
      <div class="card">
        <span class="emoji">{{ info.workspace.emoji }}</span>
        <span class="name">{{ info.workspace.name }}</span>
        <div class="meta">
          <span>{{ plural(info.tabCount, 'tab') }}</span>
          <span v-if="info.notesCount > 0" class="dot">•</span>
          <span v-if="info.notesCount > 0">{{ plural(info.notesCount, 'note') }}</span>
        </div>
        <span v-if="info.focus" class="timer">⏱ {{ timerLabel }}</span>
      </div>
      <div class="actions">
        <button class="continue" @click="store.resumeSession()">Continue</button>
        <button class="alt" @click="store.dismissResume()">Choose a different workspace</button>
      </div>
    </template>
    <template v-else>
      <h1 class="prompt">Welcome back</h1>
      <button class="continue" @click="store.dismissResume()">Choose a workspace</button>
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
  gap: 28px;
  background: var(--color-background);
  user-select: none;
}
.prompt {
  font-family: var(--serif);
  font-size: 38px;
  font-weight: 400;
  color: var(--color-text);
  letter-spacing: -0.01em;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 260px;
  padding: 28px 24px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 16px;
  background: color-mix(in srgb, var(--card-accent) 8%, var(--color-background-soft));
}
.emoji {
  font-size: 40px;
  line-height: 1;
}
.name {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ev-c-text-3);
}
.dot {
  opacity: 0.6;
}
.timer {
  margin-top: 4px;
  font-size: 12px;
  color: var(--card-accent);
  font-weight: 600;
}
.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.continue {
  padding: 11px 40px;
  border: none;
  border-radius: 10px;
  background: var(--card-accent, #4f8cff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: default;
}
.continue:hover {
  filter: brightness(1.08);
}
.alt {
  border: none;
  background: transparent;
  color: var(--ev-c-text-3);
  font-size: 13px;
  cursor: default;
}
.alt:hover {
  color: var(--color-text);
}
</style>
