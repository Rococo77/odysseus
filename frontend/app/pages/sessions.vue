<script setup lang="ts">
import type { SortMode } from '~/utils/sessions'
import type { ArchivedSession } from '~/types/sessions'

// Sessions: active list (search, sort, folders, star/rename/archive/delete,
// bulk select, auto-sort) + archived view (server-side search/sort, paginated,
// unarchive/export/delete) + a read-only history drawer with export & compact.
const {
  sessions, loading, error,
  fetchSessions, renameSession, toggleImportant, archiveSession, deleteSession,
  fetchArchived, unarchiveSession, bulkDelete, bulkArchive, autoSort, exportSession,
} = useSessions()

const view = ref<'active' | 'archived'>('active')
const query = ref('')
const sort = ref<SortMode>('active')
const grouped = ref(true)
const busyId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const notice = ref<string | null>(null)

// Bulk select (active view)
const selectMode = ref(false)
const picked = ref<string[]>([])

// Archived view
const archived = ref<ArchivedSession[]>([])
const archivedTotal = ref(0)
const archivedSort = ref('recent')
const archivedQuery = ref('')
const archivedLoading = ref(false)

onMounted(fetchSessions)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? sessions.value.filter(s => s.name.toLowerCase().includes(q)) : sessions.value
})
const flat = computed(() => sortSessions(filtered.value, sort.value))
const groups = computed(() => groupByFolder(filtered.value, sort.value))
const selected = computed(() => sessions.value.find(s => s.id === selectedId.value) || null)
const archivedHasMore = computed(() => archived.value.length < archivedTotal.value)

async function withBusy(id: string, fn: () => Promise<void>, msg: string) {
  busyId.value = id
  try { await fn(); flash(msg) }
  catch (e) { flash(e instanceof Error ? e.message : 'Action failed') }
  finally { busyId.value = null }
}

function onStar(id: string) { return withBusy(id, () => toggleImportant(id), 'Updated') }
function onRename(id: string, name: string) { return withBusy(id, () => renameSession(id, name), 'Renamed') }
function onArchive(id: string) {
  return withBusy(id, () => archiveSession(id), 'Archived').then(() => { if (selectedId.value === id) selectedId.value = null })
}
function onRemove(id: string) {
  if (!confirm('Delete this session?')) return
  return withBusy(id, () => deleteSession(id), 'Deleted').then(() => { if (selectedId.value === id) selectedId.value = null })
}
function onOpen(id: string) { selectedId.value = id }

// --- Bulk ---
function toggleSelect(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter(x => x !== id) : [...picked.value, id]
}
function exitSelect() { selectMode.value = false; picked.value = [] }
async function bulkArchiveSel() {
  if (!picked.value.length) return
  try { await bulkArchive([...picked.value]); flash(`Archived ${picked.value.length}`); exitSelect() }
  catch (e) { flash(e instanceof Error ? e.message : 'Bulk archive failed') }
}
async function bulkDeleteSel() {
  if (!picked.value.length || !confirm(`Delete ${picked.value.length} sessions?`)) return
  try { const n = await bulkDelete([...picked.value]); flash(`Deleted ${n}`); exitSelect() }
  catch (e) { flash(e instanceof Error ? e.message : 'Bulk delete failed') }
}

async function onAutoSort() {
  try {
    const r = await autoSort(false) as { updated?: number }
    await fetchSessions()
    flash(`Auto-sorted ${r.updated ?? 0} into folders`)
  } catch (e) { flash(e instanceof Error ? e.message : 'Auto-sort failed') }
}

// --- Archived ---
async function loadArchived(reset = true) {
  archivedLoading.value = true
  try {
    const offset = reset ? 0 : archived.value.length
    const res = await fetchArchived({ search: archivedQuery.value.trim() || undefined, sort: archivedSort.value, offset, limit: 20 })
    archived.value = reset ? res.sessions : [...archived.value, ...res.sessions]
    archivedTotal.value = res.total
  } catch (e) { flash(e instanceof Error ? e.message : 'Failed to load archived') }
  finally { archivedLoading.value = false }
}

watch(view, (v) => { if (v === 'archived') loadArchived(true) })
let archTimer: ReturnType<typeof setTimeout> | undefined
watch([archivedQuery, archivedSort], () => {
  clearTimeout(archTimer)
  archTimer = setTimeout(() => loadArchived(true), 300)
})

async function onUnarchive(id: string) {
  try { await unarchiveSession(id); archived.value = archived.value.filter(s => s.id !== id); archivedTotal.value--; flash('Unarchived') }
  catch (e) { flash(e instanceof Error ? e.message : 'Unarchive failed') }
}
async function onArchivedDelete(id: string) {
  if (!confirm('Delete this session?')) return
  try { await deleteSession(id); archived.value = archived.value.filter(s => s.id !== id); archivedTotal.value--; flash('Deleted') }
  catch (e) { flash(e instanceof Error ? e.message : 'Delete failed') }
}
async function onArchivedExport(id: string) {
  try { await exportSession(id, 'md') } catch (e) { flash(e instanceof Error ? e.message : 'Export failed') }
}

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
    :class="selected && view === 'active'
      ? 'grid max-w-[1200px] grid-cols-2 items-start gap-4 h-[calc(100vh-120px)]'
      : 'max-w-[900px]'"
  >
    <div :class="selected && view === 'active' ? 'overflow-auto' : ''">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-semibold">Sessions</h1>
          <div class="flex rounded-md border border-border text-sm">
            <button class="rounded px-2.5 py-1" :class="view === 'active' ? 'bg-panel2 text-fg' : 'text-muted'" @click="view = 'active'; selectedId = null">Active</button>
            <button class="rounded px-2.5 py-1" :class="view === 'archived' ? 'bg-panel2 text-fg' : 'text-muted'" @click="view = 'archived'; selectedId = null">Archived</button>
          </div>
        </div>
        <div v-if="view === 'active'" class="flex gap-2">
          <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="onAutoSort">Auto-sort</button>
          <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="selectMode ? exitSelect() : (selectMode = true)">{{ selectMode ? 'Cancel' : 'Select' }}</button>
          <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent disabled:opacity-50" :disabled="loading" @click="fetchSessions">↻</button>
        </div>
      </div>

      <!-- Bulk action bar -->
      <div v-if="view === 'active' && selectMode" class="mb-3 flex items-center gap-2 rounded-md border border-accent/40 bg-panel2 px-3 py-1.5 text-sm">
        <span class="text-muted">{{ picked.length }} selected</span>
        <button class="ml-auto rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent disabled:opacity-50" :disabled="!picked.length" @click="bulkArchiveSel">Archive</button>
        <button class="rounded-md border border-border px-2.5 py-1 text-xs text-red hover:border-red disabled:opacity-50" :disabled="!picked.length" @click="bulkDeleteSel">Delete</button>
      </div>

      <Transition name="fade">
        <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-[13px]">{{ notice }}</p>
      </Transition>

      <!-- ACTIVE VIEW -->
      <template v-if="view === 'active'">
        <div class="mb-3.5 flex items-center gap-2">
          <input v-model="query" type="search" placeholder="Filter by name…" class="flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />
          <select v-model="sort" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
            <option value="active">Last active</option>
            <option value="newest">Newest</option>
            <option value="alpha">A–Z</option>
          </select>
          <label class="flex items-center gap-1.5 text-xs text-muted">
            <input v-model="grouped" type="checkbox" class="accent-accent" /> Folders
          </label>
        </div>

        <p v-if="error" class="py-8 text-center text-red">{{ error }}</p>
        <p v-else-if="loading && !sessions.length" class="py-8 text-center text-muted">Loading…</p>
        <p v-else-if="!filtered.length" class="py-8 text-center text-muted">No sessions{{ query ? ' match your filter' : ' yet' }}.</p>

        <template v-else-if="grouped">
          <div v-for="g in groups" :key="g.folder ?? '__none'" class="mb-4">
            <div class="mb-1.5 ml-0.5 text-xs uppercase tracking-wide text-muted">{{ g.folder || 'Unfiled' }} <span class="opacity-60">{{ g.sessions.length }}</span></div>
            <div class="flex flex-col gap-1.5">
              <SessionsSessionRow v-for="s in g.sessions" :key="s.id" :session="s" :busy="busyId === s.id" :active="selectedId === s.id" :selectable="selectMode" :selected="picked.includes(s.id)" @open="onOpen" @star="onStar" @rename="onRename" @archive="onArchive" @remove="onRemove" @toggle-select="toggleSelect" />
            </div>
          </div>
        </template>

        <div v-else class="flex flex-col gap-1.5">
          <SessionsSessionRow v-for="s in flat" :key="s.id" :session="s" :busy="busyId === s.id" :active="selectedId === s.id" :selectable="selectMode" :selected="picked.includes(s.id)" @open="onOpen" @star="onStar" @rename="onRename" @archive="onArchive" @remove="onRemove" @toggle-select="toggleSelect" />
        </div>
      </template>

      <!-- ARCHIVED VIEW -->
      <template v-else>
        <div class="mb-3.5 flex items-center gap-2">
          <input v-model="archivedQuery" type="search" placeholder="Search archived…" class="flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />
          <select v-model="archivedSort" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="most-messages">Most messages</option>
            <option value="alpha">A–Z</option>
          </select>
        </div>

        <p v-if="archivedLoading && !archived.length" class="py-8 text-center text-muted">Loading…</p>
        <p v-else-if="!archived.length" class="py-8 text-center text-muted">No archived sessions{{ archivedQuery ? ' match your search' : '' }}.</p>

        <div v-else class="flex flex-col gap-1.5">
          <div v-for="s in archived" :key="s.id" class="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-2">
            <button class="min-w-0 flex-1 cursor-pointer text-left" @click="onOpen(s.id)">
              <span class="block truncate font-semibold">{{ s.name || '(untitled)' }}</span>
              <span class="text-[11px] text-muted">{{ s.model || '—' }} · {{ s.message_count }} msg · {{ formatDateTime(s.updated_at) }}</span>
            </button>
            <div class="flex shrink-0 gap-1">
              <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 text-xs text-fg hover:border-accent" title="Unarchive" @click="onUnarchive(s.id)">⇪</button>
              <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 text-xs text-fg hover:border-accent" title="Export" @click="onArchivedExport(s.id)">⤓</button>
              <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 text-xs text-fg hover:border-red" title="Delete" @click="onArchivedDelete(s.id)">🗑</button>
            </div>
          </div>
        </div>

        <div v-if="archivedHasMore" class="mt-3 flex justify-center">
          <button class="rounded-md border border-border px-4 py-2 text-sm hover:border-accent disabled:opacity-50" :disabled="archivedLoading" @click="loadArchived(false)">Load more</button>
        </div>
      </template>
    </div>

    <div v-if="selected && view === 'active'" class="sticky top-0 h-full">
      <SessionsSessionHistory :session-id="selected.id" :title="selected.name" @close="selectedId = null" />
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
