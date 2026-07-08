<script setup lang="ts">
import { reactive } from 'vue'
import { useBrowserStore } from '../stores/browser'
import type { RolesConfig } from '../../../shared/types'

const store = useBrowserStore()

type RoleKey = keyof RolesConfig
const drafts = reactive<Record<RoleKey, string>>({ essential: '', reference: '', distractions: '' })

const sections: { key: RoleKey; title: string; desc: string; accent: string }[] = [
  {
    key: 'essential',
    title: 'Essential',
    desc: 'Always allowed — your core work tools.',
    accent: '#22c55e'
  },
  {
    key: 'reference',
    title: 'Reference',
    desc: 'Allowed for looking things up — docs, search.',
    accent: '#4f8cff'
  },
  {
    key: 'distractions',
    title: 'Distractions',
    desc: 'Blocked with a speed bump during focus.',
    accent: '#f59e0b'
  }
]

function add(role: RoleKey): void {
  const pattern = drafts[role].trim()
  if (!pattern) return
  store.addRole(role, pattern)
  drafts[role] = ''
}
</script>

<template>
  <div class="settings">
    <header class="head">
      <div>
        <h1>Website Roles</h1>
        <p class="subtitle">How each site behaves while you're in a focus session.</p>
      </div>
      <button class="done" @click="store.closeSettings()">Done</button>
    </header>

    <div class="scroll">
      <div class="grid">
        <section
          v-for="sec in sections"
          :key="sec.key"
          class="section"
          :style="{ '--role-accent': sec.accent }"
        >
          <div class="sec-head">
            <h2>{{ sec.title }}</h2>
            <span class="count">{{ store.roles[sec.key].length }}</span>
          </div>
          <p class="desc">{{ sec.desc }}</p>

          <div class="tags">
            <span v-for="p in store.roles[sec.key]" :key="p" class="tag">
              <span class="letter">{{ p[0].toUpperCase() }}</span>
              {{ p }}
              <button class="x" :aria-label="`Remove ${p}`" @click="store.removeRole(sec.key, p)">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
            <div v-if="!store.roles[sec.key].length" class="empty">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              <span>No sites yet — add one below.</span>
            </div>
          </div>

          <div class="add">
            <input
              v-model="drafts[sec.key]"
              type="text"
              spellcheck="false"
              placeholder="example.com"
              @keyup.enter="add(sec.key)"
            />
            <button class="add-btn" @click="add(sec.key)">Add</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--flow-window);
  color: var(--flow-text);
  overflow: hidden;
  user-select: none;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 32px;
  border-bottom: 1px solid var(--flow-line);
  flex-shrink: 0;
}
.head h1 {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 28px;
  letter-spacing: -0.01em;
  margin: 0;
}
.subtitle {
  font-size: 13px;
  color: var(--flow-text-3);
  margin: 3px 0 0;
}
.done {
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 20px;
  cursor: default;
}
.done:hover {
  filter: brightness(1.08);
}

.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
  max-width: 1320px;
  margin: 0 auto;
}

.section {
  --role-accent: #4f8cff;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--flow-line);
  border-top: 3px solid var(--role-accent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--role-accent) 5%, var(--flow-panel));
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.sec-head h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.count {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--role-accent);
  background: color-mix(in srgb, var(--role-accent) 16%, transparent);
}
.desc {
  font-size: 12.5px;
  color: var(--flow-text-2);
  margin: 5px 0 16px;
  min-height: 32px;
  line-height: 1.45;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 7px;
  min-height: 76px;
  margin-bottom: 16px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 6px 0 7px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--flow-text);
  background: color-mix(in srgb, var(--role-accent) 12%, var(--flow-panel-2));
  border: 1px solid color-mix(in srgb, var(--role-accent) 28%, transparent);
}
.letter {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: var(--role-accent);
  color: #0c0d12;
  font-size: 10px;
  font-weight: 700;
}
.x {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--flow-text-3);
  cursor: default;
}
.x:hover {
  background: color-mix(in srgb, var(--role-accent) 22%, transparent);
  color: var(--role-accent);
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 76px;
  color: var(--flow-text-4);
}
.empty span {
  font-size: 12px;
}

.add {
  display: flex;
  gap: 7px;
}
.add input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--flow-line-2);
  border-radius: 9px;
  background: var(--flow-panel-2);
  color: var(--flow-text);
  font-size: 13px;
  outline: none;
}
.add input:focus {
  border-color: var(--role-accent);
}
.add-btn {
  height: 34px;
  flex-shrink: 0;
  border: none;
  border-radius: 9px;
  background: var(--role-accent);
  color: #0c0d12;
  font-size: 13px;
  font-weight: 600;
  padding: 0 16px;
  cursor: default;
}
.add-btn:hover {
  filter: brightness(1.08);
}
</style>
