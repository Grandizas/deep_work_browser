<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()
const textarea = ref<HTMLTextAreaElement | null>(null)
const body = ref(store.noteBody)

const origin = computed(() => store.noteOrigin)
const hasOrigin = computed(() => origin.value.length > 0)

let timer: ReturnType<typeof setTimeout> | undefined

// When the active site changes, flush the previous site's edit (to the OLD
// origin) before loading the new one. Same-origin pushes (e.g. the autosave
// echo) don't fire this, so they never clobber what the user is typing.
watch(origin, (_next, prev) => {
  clearTimeout(timer)
  if (prev) store.saveNote(prev, body.value)
  body.value = store.noteBody
})

// Debounced autosave for the current site.
watch(body, () => {
  if (!hasOrigin.value) return
  clearTimeout(timer)
  const o = origin.value
  timer = setTimeout(() => store.saveNote(o, body.value), 400)
})

// Flush any pending edit immediately when the panel closes.
function flush(): void {
  clearTimeout(timer)
  if (hasOrigin.value) store.saveNote(origin.value, body.value)
}

onMounted(() => textarea.value?.focus())
onBeforeUnmount(flush)
</script>

<template>
  <aside class="notes-panel">
    <header class="notes-header">
      <span class="label">Notes</span>
      <span v-if="hasOrigin" class="origin" :title="origin">{{ origin }}</span>
      <button
        class="close"
        aria-label="Close notes"
        title="Close (Ctrl+Shift+N)"
        @click="store.closeNotes()"
      >
        ✕
      </button>
    </header>
    <textarea
      v-if="hasOrigin"
      ref="textarea"
      v-model="body"
      class="notes-body"
      spellcheck="false"
      placeholder="Jot something about this site…"
    />
    <p v-else class="empty">Open a website to take notes about it.</p>
  </aside>
</template>

<style scoped>
.notes-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  display: flex;
  flex-direction: column;
  background: var(--color-background-soft);
  border-left: 1px solid var(--ev-c-gray-3);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.18);
}
.notes-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ev-c-gray-3);
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.origin {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ev-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close {
  border: none;
  background: transparent;
  color: var(--ev-c-text-3);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.close:hover {
  color: var(--color-text);
  background: var(--ev-c-gray-3);
}
.notes-body {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  padding: 14px;
}
.empty {
  padding: 20px 16px;
  font-size: 13px;
  color: var(--ev-c-text-3);
}
</style>
