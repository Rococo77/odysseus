<template>
  <div class="app-shell">
    <header class="topbar">
      <span class="brand">Odysseus</span>
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
.badge {
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
