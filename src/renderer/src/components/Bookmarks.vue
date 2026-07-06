<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'

const store = useBrowserStore()

// Short label for a pinned URL: its hostname without a leading www.
function label(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <div class="bookmarks">
    <div
      v-for="url in store.pinnedSites"
      :key="url"
      class="pin"
      role="button"
      tabindex="0"
      :title="url"
      @click="store.navigate(url)"
      @keydown.enter="store.navigate(url)"
      @keydown.space.prevent="store.navigate(url)"
    >
      <span class="dot" />
      <span class="label">{{ label(url) }}</span>
      <button class="unpin" aria-label="Unpin" title="Unpin" @click.stop="store.unpinSite(url)">
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.bookmarks {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 10px;
  overflow-x: auto;
  scrollbar-width: none;
  border-top: 1px solid color-mix(in srgb, var(--accent) 20%, var(--ev-c-gray-3));
}
.bookmarks::-webkit-scrollbar {
  display: none;
}

.pin {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 4px 0 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 12px;
  cursor: default;
}
.pin:hover {
  background: var(--color-background-mute);
  color: var(--color-text);
}
.pin:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  color: var(--color-text);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--accent);
}

.label {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unpin {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: default;
  opacity: 0;
}
.pin:hover .unpin {
  opacity: 0.6;
}
.unpin:hover {
  opacity: 1;
  background: var(--ev-c-gray-2);
}
</style>
