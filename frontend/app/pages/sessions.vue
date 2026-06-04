<script setup lang="ts">
import type { SortMode } from '~/utils/sessions'

// Second migrated page (after Tasks). Read-heavy: lists active chat sessions
// with search, sort, folder grouping, star/rename/archive/delete, plus a
// read-only history preview. Chat streaming itself stays in the legacy app
// until the Chat migration.
const {
  sessions, loading, error,
  fetchSessions, renameSession, toggleImportant, archiveSession, deleteSession,
} = useSessions()

const query = ref('')
const sort = ref<SortMode>('active')
const grouped = ref(true)
const busyId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const notice = ref<string | null>(null)

onMounted(fetchSessions)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? sessions.value.filter(s => s.name.toLowerCase().includes(q)) : sessions.value
})
const flat = computed(() => sortSessions(filtered.value, sort.value))
const groups = computed(() => groupByFolder(filtered.value, sort.value))

const selected = computed(() => sessions.value.find(s => s.id === selectedId.value) || null)

async function withBusy(id: string, fn: () => Promise<void>, msg: string) {
  busyId.value = id
  try {
    await fn()
    flash(msg)
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Action failed')
  } finally {
    busyId.value = null
  }
}

function onStar(id: string) { return withBusy(id, () => toggleImportant(id), 'Updated') }
function onRename(id: string, name: string) { return withBusy(id, () => renameSession(id, name), 'Renamed') }
function onArchive(id: string) {
  return withBusy(id, () => archiveSession(id), 'Archived').then(() => {
    if (selectedId.value === id) selectedId.value = null
  })
}
function onRemove(id: string) {
  if (!confirm('Delete this session?')) return
  return withBusy(id, () => deleteSession(id), 'Deleted').then(() => {
    if (selectedId.value === id) selectedId.value = null
  })
}
function onOpen(id: string) { selectedId.value = id }

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2500)
}
</script>

<template>
  <section class="sessions" :class="{ split: selected }">
    <div class="list-col">
      <div class="head">
        <h1>Sessions</h1>
        <div class="head-actions">
          <button class="ghost" :disabled="loading" @click="fetchSessions">↻ Refresh</button>
        </div>
      </div>

      <div class="toolbar">
        <input v-model="query" class="search" type="search" placeholder="Filter by name…" />
        <select v-model="sort" class="select">
          <option value="active">Last active</option>
          <option value="newest">Newest</option>
          <option value="alpha">A–Z</option>
        </select>
        <label class="group-toggle">
          <input v-model="grouped" type="checkbox" />
          <span>Folders</span>
        </label>
      </div>

      <Transition name="fade">
        <p v-if="notice" class="notice">{{ notice }}</p>
      </Transition>

      <p v-if="error" class="state error">{{ error }}</p>
      <p v-else-if="loading && !sessions.length" class="state">Loading…</p>
      <p v-else-if="!filtered.length" class="state">No sessions{{ query ? ' match your filter' : ' yet' }}.</p>

      <template v-else-if="grouped">
        <div v-for="g in groups" :key="g.folder ?? '__none'" class="group">
          <div class="group-head">{{ g.folder || 'Unfiled' }} <span class="count">{{ g.sessions.length }}</span></div>
          <div class="list">
            <SessionsSessionRow
              v-for="s in g.sessions"
              :key="s.id"
              :session="s"
              :busy="busyId === s.id"
              :active="selectedId === s.id"
              @open="onOpen" @star="onStar" @rename="onRename" @archive="onArchive" @remove="onRemove"
            />
          </div>
        </div>
      </template>

      <div v-else class="list">
        <SessionsSessionRow
          v-for="s in flat"
          :key="s.id"
          :session="s"
          :busy="busyId === s.id"
          :active="selectedId === s.id"
          @open="onOpen" @star="onStar" @rename="onRename" @archive="onArchive" @remove="onRemove"
        />
      </div>
    </div>

    <div v-if="selected" class="detail-col">
      <SessionsSessionHistory :session-id="selected.id" :title="selected.name" @close="selectedId = null" />
    </div>
  </section>
</template>

<style scoped>
.sessions { max-width: 900px; margin: 0 auto; }
.sessions.split {
  max-width: 1200px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  height: calc(100vh - 120px);
}
.sessions.split .list-col { overflow: auto; }
.sessions.split .detail-col { height: 100%; position: sticky; top: 0; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
h1 { margin: 0; font-size: 1.4rem; }
.head-actions button { border-radius: 6px; padding: 0.4rem 0.8rem; border: 1px solid var(--border); background: transparent; color: var(--fg); }
.toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.85rem; }
.search { flex: 1; }
.search, .select {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--fg);
  padding: 0.4rem 0.55rem;
  font: inherit;
}
.search:focus, .select:focus { outline: none; border-color: var(--accent); }
.group-toggle { display: flex; align-items: center; gap: 0.35rem; font-size: 12px; color: var(--muted); }
.group { margin-bottom: 1rem; }
.group-head { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 0.4rem 0.2rem; }
.group-head .count { opacity: 0.6; }
.list { display: flex; flex-direction: column; gap: 0.45rem; }
.state { color: var(--muted); padding: 2rem 0; text-align: center; }
.state.error { color: var(--red); }
.notice { background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.7rem; margin: 0 0 0.8rem; font-size: 13px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
