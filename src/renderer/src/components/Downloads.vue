<script setup lang="ts">
import { useBrowserStore } from '../stores/browser'
import type { DownloadState } from '../../../shared/types'

const store = useBrowserStore()

function fmtBytes(n: number): string {
  if (n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function progress(d: DownloadState): number {
  return d.totalBytes > 0 ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100)) : 0
}

function statusText(d: DownloadState): string {
  switch (d.state) {
    case 'progressing':
      return d.totalBytes > 0
        ? `${progress(d)}% · ${fmtBytes(d.receivedBytes)} / ${fmtBytes(d.totalBytes)}`
        : fmtBytes(d.receivedBytes)
    case 'completed':
      return fmtBytes(d.receivedBytes)
    case 'paused':
      return 'Paused'
    case 'cancelled':
      return 'Cancelled'
    case 'interrupted':
      return 'Failed'
  }
}
</script>

<template>
  <div class="shelf">
    <div class="items">
      <div v-for="d in store.downloads" :key="d.id" class="chip" :class="d.state">
        <div class="chip-body">
          <span class="name" :title="d.filename">{{ d.filename }}</span>
          <div v-if="d.state === 'progressing'" class="bar">
            <div class="fill" :style="{ width: progress(d) + '%' }" />
          </div>
          <span class="status">{{ statusText(d) }}</span>
        </div>
        <button
          v-if="d.state === 'progressing'"
          class="chip-action"
          aria-label="Cancel download"
          title="Cancel"
          @click="store.cancelDownload(d.id)"
        >
          ✕
        </button>
        <button
          v-else-if="d.state === 'completed'"
          class="chip-action open"
          @click="store.openDownload(d.id)"
        >
          Open
        </button>
      </div>
    </div>
    <button class="clear" title="Clear finished downloads" @click="store.clearDownloads()">
      Clear
    </button>
  </div>
</template>

<style scoped>
.shelf {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 10px;
  border-top: 1px solid var(--ev-c-gray-3);
  background: var(--color-background-soft);
}

.items {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.items::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 240px;
  height: 36px;
  padding: 0 6px 0 10px;
  border-radius: 8px;
  background: var(--color-background-mute);
}
.chip.interrupted,
.chip.cancelled {
  opacity: 0.6;
}

.chip-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--color-text);
}
.status {
  font-size: 10px;
  color: var(--ev-c-text-3);
}

.bar {
  height: 3px;
  border-radius: 2px;
  background: var(--ev-c-gray-3);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: #4f8cff;
  transition: width 0.15s linear;
}

.chip-action {
  flex-shrink: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 12px;
  padding: 4px 6px;
  cursor: default;
}
.chip-action.open {
  background: var(--ev-c-gray-3);
  color: var(--color-text);
}
.chip-action:hover {
  background: var(--ev-c-gray-2);
  color: var(--color-text);
}

.clear {
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 11px;
  padding: 5px 8px;
  cursor: default;
}
.clear:hover {
  background: var(--color-background-mute);
  color: var(--color-text);
}
</style>
