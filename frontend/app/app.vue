<script setup lang="ts">
// Register global Ctrl/Cmd+1..7 page navigation.
useShortcuts()
const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = computed(() => (isMac ? '⌘' : 'Ctrl'))
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <span class="brand">Odysseus</span>
      <nav class="nav">
        <NuxtLink
          v-for="(item, i) in NAV_SHORTCUTS"
          :key="item.to"
          :to="item.to"
          :title="`${item.label} (${mod}+${i + 1})`"
        >{{ item.label }}</NuxtLink>
      </nav>
      <span class="badge">desktop · pilot</span>
    </header>
    <main class="content">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  -webkit-user-select: none;
  user-select: none;
}
.brand {
  font-weight: 600;
  letter-spacing: 0.02em;
}
.nav {
  display: flex;
  gap: 0.25rem;
}
.nav a {
  color: var(--muted);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 13px;
}
.nav a:hover {
  color: var(--fg);
  background: var(--panel-2);
}
.nav a.router-link-active {
  color: var(--fg);
  background: var(--panel-2);
}
.badge {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}
.content {
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}
</style>
