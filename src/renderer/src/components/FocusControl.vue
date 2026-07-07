<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
</script>

<template>
  <!-- Idle: a button to start a focus session (duration presets in a native menu).
       Active state (countdown, stop) is expanded in the timer-display step. -->
  <button
    v-if="store.focus.state === 'idle'"
    class="focus-btn"
    title="Start a focus session"
    @click="store.openFocusMenu()"
  >
    <span class="dot" />
    Focus
  </button>
  <div v-else class="focus-active" :class="store.focus.state">
    {{ store.focus.state === 'focus' ? 'Focusing' : 'Break' }}
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
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.focus-active.break {
  background: color-mix(in srgb, #22c55e 18%, transparent);
}
</style>
