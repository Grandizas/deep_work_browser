<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
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
import ResumeCard from './components/ResumeCard.vue'
import AmbientAudio from './components/AmbientAudio.vue'
import FindBar from './components/FindBar.vue'
import HistoryView from './components/HistoryView.vue'
import LeftSidebar from './components/LeftSidebar.vue'
import RightSidebar from './components/RightSidebar.vue'

const store = useBrowserStore()

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
  <HistoryView v-else-if="store.showHistory" />
  <CommandPalette v-else-if="store.showPalette" />
  <div v-else id="flow">
    <LeftSidebar v-if="store.showLeftSidebar" />
    <main class="flow-center">
      <Toolbar />
      <TabBar />
      <Bookmarks v-if="store.pinnedSites.length" />
      <PermissionPrompt />
      <Downloads v-if="store.downloads.length" />
      <FindBar v-if="store.showFind" />
      <!-- The active tab's WebContentsView is positioned by main to cover this
           hole exactly (see contentRegion in index.ts). -->
      <div class="flow-content"></div>
    </main>
    <RightSidebar v-if="store.showRightSidebar" />
  </div>
  <AmbientAudio />
</template>

<style scoped>
#flow {
  display: flex;
  height: 100vh;
  background: var(--flow-window);
  color: var(--flow-text);
}
.flow-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* Transparent hole below the top bar + tab bar; the inset tab view sits here.
   Padding (16px) mirrors FLOW_PAD in main so the card lines up. */
.flow-content {
  flex: 1;
  min-height: 0;
  padding: 16px;
  background: radial-gradient(circle at 50% -10%, rgba(129, 140, 248, 0.06), transparent 55%);
}
</style>
