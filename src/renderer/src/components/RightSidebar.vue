<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

const origin = computed(() => store.noteOrigin)
const hasOrigin = computed(() => origin.value.length > 0)
const activeTitle = computed(() => store.activeTab?.title || store.activeTab?.url || 'New Tab')

const body = ref(store.noteBody)
let timer: ReturnType<typeof setTimeout> | undefined

// Reload the textarea only when the active site changes (flush the old first),
// so same-origin state pushes never clobber what the user is typing.
watch(origin, (_next, prev) => {
  clearTimeout(timer)
  if (prev) store.saveNote(prev, body.value)
  body.value = store.noteBody
})
watch(body, () => {
  if (!hasOrigin.value) return
  clearTimeout(timer)
  const o = origin.value
  timer = setTimeout(() => store.saveNote(o, body.value), 400)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  if (hasOrigin.value) store.saveNote(origin.value, body.value)
})
</script>

<template>
  <aside class="right">
    <!-- Active page header -->
    <div class="page">
      <span class="fav">
        <img v-if="store.activeTab?.favicon" :src="store.activeTab.favicon" alt="" />
      </span>
      <span class="page-title">{{ activeTitle }}</span>
    </div>

    <!-- Website notes -->
    <div class="notes">
      <div class="label">Website Notes</div>
      <div v-if="hasOrigin" class="origin">{{ origin }}</div>
      <textarea
        v-if="hasOrigin"
        v-model="body"
        class="note-input"
        spellcheck="false"
        placeholder="Jot something about this site…"
      />
      <p v-else class="empty">Open a website to take notes about it.</p>
    </div>
  </aside>
</template>

<style scoped>
.right {
  width: 308px;
  flex: 0 0 308px;
  background: var(--flow-sidebar);
  border-left: 1px solid var(--flow-line);
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 14px;
  user-select: none;
}
.page {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 6px;
}
.fav {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--flow-panel-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
}
.fav img {
  width: 14px;
  height: 14px;
}
.page-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--flow-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--flow-panel);
  border: 1px solid var(--flow-line);
  border-radius: 14px;
  padding: 14px;
}
.label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--flow-text-4);
  margin-bottom: 8px;
}
.origin {
  font-size: 12px;
  color: var(--flow-text-3);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-input {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--flow-text);
  font: inherit;
  font-size: 13.5px;
  line-height: 1.55;
}
.empty {
  font-size: 13px;
  color: var(--flow-text-3);
  line-height: 1.5;
}
</style>
