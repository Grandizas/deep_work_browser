<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useBrowserStore } from './stores/browser'
import TabBar from './components/TabBar.vue'
import Toolbar from './components/Toolbar.vue'
import Bookmarks from './components/Bookmarks.vue'
import Downloads from './components/Downloads.vue'
import PermissionPrompt from './components/PermissionPrompt.vue'
import WorkspacePicker from './components/WorkspacePicker.vue'
import Settings from './components/Settings.vue'
import CompletionScreen from './components/CompletionScreen.vue'
import CommandPalette from './components/CommandPalette.vue'
import NotesPanel from './components/NotesPanel.vue'
import ResumeCard from './components/ResumeCard.vue'
import AmbientAudio from './components/AmbientAudio.vue'
import FindBar from './components/FindBar.vue'

const store = useBrowserStore()

// The active workspace's theme colour, exposed as a CSS variable that the whole
// chrome UI accents off of. Changes reactively when you switch workspaces.
const accent = computed(() => store.activeWorkspace?.themeColor ?? '#4f8cff')

let unsubscribe: (() => void) | undefined

onMounted(() => {
  // Mirror every state push from main, then ask for the initial snapshot.
  unsubscribe = window.api.onState((state) => store.apply(state))
  window.api.send('ui:ready')
})

onUnmounted(() => unsubscribe?.())
</script>

<template>
  <ResumeCard v-if="store.showResume" />
  <WorkspacePicker v-else-if="store.showPicker" />
  <Settings v-else-if="store.showSettings" />
  <CompletionScreen v-else-if="store.showCompletion" />
  <CommandPalette v-else-if="store.showPalette" />
  <div
    v-else
    id="chrome"
    :class="{ 'notes-open': store.showNotes }"
    :style="{ '--accent': accent }"
  >
    <TabBar />
    <Toolbar />
    <FindBar v-if="store.showFind" />
    <Bookmarks v-if="store.pinnedSites.length" />
    <PermissionPrompt />
    <Downloads v-if="store.downloads.length" />
  </div>
  <NotesPanel v-if="store.showNotes" />
  <AmbientAudio />
</template>

<style scoped>
#chrome {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* Subtle per-workspace background shift: the chrome strip is faintly tinted
     with the workspace accent, with a stronger accent hairline at the bottom. */
  background: color-mix(in srgb, var(--accent) 7%, var(--color-background-soft));
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 45%, var(--ev-c-gray-3));
  transition: background 0.25s ease;
}
/* With the notes panel open, chrome fills the window (so the tab view shrinks to
   the left); constrain the strip so the toolbar doesn't run under the panel. */
#chrome.notes-open {
  width: calc(100% - 340px);
}
</style>
