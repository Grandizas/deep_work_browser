<script setup lang="ts"></script>

<template>
  <div id="chrome">
    <span class="brand">deep_work</span>
  </div>
</template>

<style scoped>
#chrome {
  height: 100vh;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--ev-c-gray-3);
}

.brand {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.02em;
}
</style>
