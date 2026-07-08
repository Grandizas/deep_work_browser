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
      <h1>Website Roles</h1>
      <button class="done" @click="store.closeSettings()">Done</button>
    </header>

    <div class="sections">
      <section
        v-for="sec in sections"
        :key="sec.key"
        class="section"
        :style="{ '--role-accent': sec.accent }"
      >
        <h2>{{ sec.title }}</h2>
        <p class="desc">{{ sec.desc }}</p>

        <div class="chips">
          <span v-for="p in store.roles[sec.key]" :key="p" class="chip">
            {{ p }}
            <button class="x" aria-label="Remove" @click="store.removeRole(sec.key, p)">×</button>
          </span>
          <span v-if="!store.roles[sec.key].length" class="empty">Nothing here yet.</span>
        </div>

        <div class="add">
          <input
            v-model="drafts[sec.key]"
            type="text"
            spellcheck="false"
            placeholder="example.com"
            @keyup.enter="add(sec.key)"
          />
          <button @click="add(sec.key)">Add</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  color: var(--color-text);
  user-select: none;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 32px;
  border-bottom: 1px solid var(--flow-line);
}
.head h1 {
  font-family: var(--serif);
  font-weight: 400;
  font-size: 28px;
  letter-spacing: -0.01em;
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

.sections {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 28px;
}

.section {
  /* Default so tooling resolves var(--role-accent); the inline :style binding
     overrides it per section with the role's colour. */
  --role-accent: #4f8cff;
  display: flex;
  flex-direction: column;
  padding: 18px;
  border: 1px solid var(--flow-line);
  border-top: 3px solid var(--role-accent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--role-accent) 5%, var(--flow-panel));
}
.section h2 {
  font-size: 15px;
  font-weight: 600;
}
.desc {
  font-size: 12px;
  color: var(--ev-c-text-2);
  margin: 4px 0 14px;
  min-height: 30px;
}

.chips {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  min-height: 60px;
  margin-bottom: 14px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  border-radius: 6px;
  background: var(--color-background-mute);
  font-size: 12px;
}
.x {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ev-c-text-2);
  font-size: 14px;
  line-height: 1;
  cursor: default;
}
.x:hover {
  background: var(--ev-c-gray-2);
  color: var(--color-text);
}
.empty {
  font-size: 12px;
  color: var(--ev-c-text-3);
}

.add {
  display: flex;
  gap: 6px;
}
.add input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ev-c-gray-3);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 12px;
  outline: none;
}
.add input:focus {
  border-color: var(--role-accent);
}
.add button {
  border: none;
  border-radius: 6px;
  background: var(--role-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 0 14px;
  cursor: default;
}
.add button:hover {
  filter: brightness(1.08);
}
</style>
