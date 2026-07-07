<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const query = ref('')
const input = ref<HTMLInputElement | null>(null)

onMounted(() => input.value?.focus())
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
      />
      <div class="results">
        <p class="hint">Commands coming soon…</p>
      </div>
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
  background: rgba(0, 0, 0, 0.35);
  user-select: none;
}

.palette {
  width: 620px;
  max-width: 92vw;
  background: var(--color-background-soft);
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.query {
  width: 100%;
  height: 52px;
  padding: 0 20px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 16px;
  outline: none;
}

.results {
  min-height: 80px;
  max-height: 50vh;
  overflow-y: auto;
  border-top: 1px solid var(--ev-c-gray-3);
  padding: 8px;
}
.hint {
  padding: 16px;
  font-size: 13px;
  color: var(--ev-c-text-3);
  text-align: center;
}
</style>
