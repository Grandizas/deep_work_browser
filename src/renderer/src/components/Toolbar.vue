<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const urlInput = ref<HTMLInputElement | null>(null)
const draft = ref('')
const editing = ref(false)

// Show nothing for a blank tab so the placeholder shows through.
function display(url: string | undefined): string {
  return url && url !== 'about:blank' ? url : ''
}

// Reflect the active tab's URL into the field, but never clobber what the user
// is currently typing.
watch(
  () => [store.activeTab?.url, store.activeTabId] as const,
  () => {
    if (!editing.value) draft.value = display(store.activeTab?.url)
  },
  { immediate: true }
)

// Main asks us to focus the address bar (Ctrl+L, new tab) by bumping this seq.
watch(
  () => store.focusUrlBarSeq,
  () => {
    editing.value = true
    nextTick(() => {
      urlInput.value?.focus()
      urlInput.value?.select()
    })
  }
)

function onFocus(): void {
  editing.value = true
  urlInput.value?.select()
}
function onBlur(): void {
  editing.value = false
  draft.value = display(store.activeTab?.url)
}
function onEnter(): void {
  store.navigate(draft.value)
  urlInput.value?.blur()
}
</script>

<template>
  <div class="toolbar">
    <button
      class="nav"
      title="Back"
      :disabled="!store.activeTab?.canGoBack"
      @click="store.back()"
    >
      ‹
    </button>
    <button
      class="nav"
      title="Forward"
      :disabled="!store.activeTab?.canGoForward"
      @click="store.forward()"
    >
      ›
    </button>
    <button class="nav" title="Reload" @click="store.reload()">⟳</button>
    <input
      ref="urlInput"
      v-model="draft"
      class="url"
      type="text"
      spellcheck="false"
      autocomplete="off"
      placeholder="Search or enter address"
      @focus="onFocus"
      @blur="onBlur"
      @keyup.enter="onEnter"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 10px;
  background: var(--color-background);
}

.nav {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 18px;
  line-height: 1;
  cursor: default;
}
.nav:hover:not(:disabled) {
  background: var(--color-background-mute);
}
.nav:disabled {
  opacity: 0.3;
}

.url {
  flex: 1;
  min-width: 0;
  height: 32px;
  margin-left: 4px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--color-background-mute);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}
.url:focus {
  border-color: var(--ev-c-gray-1);
  background: var(--color-background-soft);
}
</style>
