<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
</script>

<template>
  <div class="picker">
    <div class="brand">
      <div class="mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round">
          <path d="M3 13c2.5-5 5.5 5 9 0s6.5-5 9 0" />
        </svg>
      </div>
      <span class="word">Forge</span>
    </div>

    <h1 class="prompt">What are you working on today?</h1>

    <div class="grid">
      <button
        v-for="w in store.workspaces"
        :key="w.id"
        class="card"
        :style="{ '--card-accent': w.themeColor }"
        @click="store.startWorkspace(w.id)"
      >
        <span class="dot" />
        <span class="emoji">{{ w.emoji }}</span>
        <span class="name">{{ w.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  background: var(--flow-app);
  background-image: radial-gradient(circle at 50% 8%, rgba(129, 140, 248, 0.08), transparent 45%);
  user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
}
.mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: grid;
  place-items: center;
  box-shadow: 0 6px 20px rgba(129, 140, 248, 0.45);
}
.word {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.prompt {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 44px;
  letter-spacing: -0.01em;
  color: var(--flow-text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.card {
  --card-accent: #818cf8;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 156px;
  height: 128px;
  border: 1px solid var(--flow-line-2);
  border-radius: 16px;
  background: color-mix(in srgb, var(--card-accent) 6%, var(--flow-panel));
  color: var(--flow-text);
  cursor: default;
  transition:
    transform 0.14s ease,
    border-color 0.14s ease,
    background 0.14s ease;
}
.card:hover {
  transform: translateY(-3px);
  border-color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 14%, var(--flow-panel));
}
.dot {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--card-accent);
  box-shadow: 0 0 10px var(--card-accent);
}
.emoji {
  font-size: 34px;
  line-height: 1;
}
.name {
  font-size: 14px;
  font-weight: 600;
}
</style>
