<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useBrowserStore } from './stores/browser'
import TabBar from './components/TabBar.vue'
import Toolbar from './components/Toolbar.vue'

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
  <div id="chrome">
    <TabBar />
    <Toolbar />
  </div>
</template>

<style scoped>
#chrome {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--ev-c-gray-3);
}
</style>
