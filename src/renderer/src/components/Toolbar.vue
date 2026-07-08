<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useBrowserStore } from '../stores/browser'
import FocusControl from './FocusControl.vue'

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
      aria-label="Back"
      title="Back"
      :disabled="!store.activeTab?.canGoBack"
      @click="store.back()"
    >
      ‹
    </button>
    <button
      class="nav"
      aria-label="Forward"
      title="Forward"
      :disabled="!store.activeTab?.canGoForward"
      @click="store.forward()"
    >
      ›
    </button>
    <button class="nav" aria-label="Reload" title="Reload" @click="store.reload()">⟳</button>
    <div class="url-wrap">
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
      <span
        v-if="store.activeHasNote"
        class="note-dot"
        title="This site has notes"
        @click="store.toggleNotes()"
      />
    </div>
    <button
      class="nav star"
      :class="{ active: store.isActiveTabPinned }"
      :aria-label="store.isActiveTabPinned ? 'Unpin site' : 'Pin site'"
      :title="store.isActiveTabPinned ? 'Unpin from workspace' : 'Pin to workspace'"
      @click="store.toggleActiveTabPinned()"
    >
      {{ store.isActiveTabPinned ? '★' : '☆' }}
    </button>
    <button
      class="nav notes-btn"
      :class="{ active: store.showNotes }"
      aria-label="Notes"
      title="Notes (Ctrl+Shift+N)"
      @click="store.toggleNotes()"
    >
      📝
    </button>
    <button
      class="nav"
      aria-label="Website roles settings"
      title="Website roles"
      @click="store.openSettings()"
    >
      ⚙
    </button>
    <FocusControl />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 10px;
  /* Transparent so the workspace-tinted chrome background shows through. */
  background: transparent;
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

.star {
  font-size: 16px;
}
.star.active {
  color: var(--accent);
}

.url-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  margin-left: 4px;
  display: flex;
  align-items: center;
}
.url {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--color-background-mute);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}
.url:focus {
  border-color: var(--accent, var(--ev-c-gray-1));
  background: var(--color-background-soft);
}
/* Indicator that the current site has a saved note. Click jumps to the panel. */
.note-dot {
  position: absolute;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent, #4f8cff);
  cursor: default;
}
.notes-btn {
  font-size: 14px;
}
.notes-btn.active {
  background: var(--color-background-mute);
  color: var(--accent);
}
</style>
