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
    <div class="nav-group">
      <button
        class="nav"
        aria-label="Back"
        title="Back"
        :disabled="!store.activeTab?.canGoBack"
        @click="store.back()"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        class="nav"
        aria-label="Forward"
        title="Forward"
        :disabled="!store.activeTab?.canGoForward"
        @click="store.forward()"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <button class="nav" aria-label="Reload" title="Reload" @click="store.reload()">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 11a8 8 0 1 0-.7 4" />
          <path d="M20 4v5h-5" />
        </svg>
      </button>
    </div>

    <div class="addr-wrap">
      <div class="addr" :class="{ focused: editing }">
        <svg
          class="lock"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5e8f6e"
          stroke-width="2"
          stroke-linecap="round"
        >
          <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
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
        <button
          v-if="store.zoomPercent !== 100"
          class="zoom"
          aria-label="Reset zoom"
          title="Reset zoom (Ctrl+0)"
          @mousedown.prevent
          @click="store.zoomReset()"
        >
          {{ store.zoomPercent }}%
        </button>
        <span v-if="store.activeHasNote" class="note-dot" title="This site has notes" />
      </div>
    </div>

    <div class="right-group">
      <button
        class="nav star"
        :class="{ active: store.isActiveTabPinned }"
        :title="store.isActiveTabPinned ? 'Unpin from workspace' : 'Pin to workspace'"
        @click="store.toggleActiveTabPinned()"
      >
        {{ store.isActiveTabPinned ? '★' : '☆' }}
      </button>
      <FocusControl />
      <button
        class="nav"
        aria-label="Website roles settings"
        title="Website roles"
        @click="store.openSettings()"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L16 3H8l-.5 2.4a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 3 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L8 21h8l.5-2.4a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 54px;
  flex: 0 0 54px;
  padding: 0 18px;
  border-bottom: 1px solid var(--flow-line);
  background: transparent;
}
.nav-group {
  display: flex;
  gap: 2px;
}
.right-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--flow-text-2);
  line-height: 1;
  cursor: default;
}
.nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--flow-text);
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

/* Centered address pill */
.addr-wrap {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}
.addr {
  width: 520px;
  max-width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border-radius: 11px;
  background: var(--flow-panel);
  border: 1px solid var(--flow-line-2);
}
.addr.focused {
  border-color: var(--accent-border);
  background: var(--flow-panel-2);
}
.lock {
  flex-shrink: 0;
}
.url {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--flow-text);
  font-size: 13.5px;
  outline: none;
}
.url::placeholder {
  color: var(--flow-text-3);
}
.zoom {
  flex-shrink: 0;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--flow-text-3);
  cursor: default;
}
.zoom:hover {
  color: var(--flow-text);
}
.note-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}
</style>
