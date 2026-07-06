<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
</script>

<template>
  <div class="picker">
    <h1 class="prompt">What are you working on today?</h1>
    <div class="grid">
      <button
        v-for="w in store.workspaces"
        :key="w.id"
        class="card"
        :style="{ '--card-accent': w.themeColor }"
        @click="store.startWorkspace(w.id)"
      >
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
  gap: 40px;
  background: var(--color-background);
  user-select: none;
}

.prompt {
  font-size: 26px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.01em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.card {
  /* Default so tooling resolves var(--card-accent); the inline :style binding
     overrides it per card with the workspace's themeColor. */
  --card-accent: #4f8cff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 150px;
  height: 120px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 14px;
  background: color-mix(in srgb, var(--card-accent) 6%, var(--color-background-soft));
  color: var(--color-text);
  cursor: default;
  transition:
    transform 0.12s ease,
    border-color 0.12s ease,
    background 0.12s ease;
}
.card:hover {
  transform: translateY(-3px);
  border-color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 14%, var(--color-background-soft));
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
