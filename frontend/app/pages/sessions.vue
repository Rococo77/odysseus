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
  <section
    class="mx-auto"
    :class="selected
      ? 'grid max-w-[1200px] grid-cols-2 items-start gap-4 h-[calc(100vh-120px)]'
      : 'max-w-[900px]'"
  >
    <div :class="selected ? 'overflow-auto' : ''">
      <div class="mb-3 flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Sessions</h1>
        <button class="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:border-accent disabled:opacity-50" :disabled="loading" @click="fetchSessions">↻ Refresh</button>
      </div>

      <div class="mb-3.5 flex items-center gap-2">
        <input v-model="query" type="search" placeholder="Filter by name…" class="flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />
        <select v-model="sort" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
          <option value="active">Last active</option>
          <option value="newest">Newest</option>
          <option value="alpha">A–Z</option>
        </select>
        <label class="flex items-center gap-1.5 text-xs text-muted">
          <input v-model="grouped" type="checkbox" class="accent-accent" />
          <span>Folders</span>
        </label>
      </div>

      <Transition name="fade">
        <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-[13px]">{{ notice }}</p>
      </Transition>

      <p v-if="error" class="py-8 text-center text-red">{{ error }}</p>
      <p v-else-if="loading && !sessions.length" class="py-8 text-center text-muted">Loading…</p>
      <p v-else-if="!filtered.length" class="py-8 text-center text-muted">No sessions{{ query ? ' match your filter' : ' yet' }}.</p>

      <template v-else-if="grouped">
        <div v-for="g in groups" :key="g.folder ?? '__none'" class="mb-4">
          <div class="mb-1.5 ml-0.5 text-xs uppercase tracking-wide text-muted">{{ g.folder || 'Unfiled' }} <span class="opacity-60">{{ g.sessions.length }}</span></div>
          <div class="flex flex-col gap-1.5">
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

      <div v-else class="flex flex-col gap-1.5">
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

    <div v-if="selected" class="sticky top-0 h-full">
      <SessionsSessionHistory :session-id="selected.id" :title="selected.name" @close="selectedId = null" />
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
