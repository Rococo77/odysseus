<script setup lang="ts">
import type { Note, NoteCreate } from '~/types/notes'

// Fourth migrated page (Tailwind). Notes board: active/archived views, plain
// notes and checklists, create/edit, pin, archive, delete, item toggle, with
// label filter and text search, plus drag-reorder (active, unfiltered view).
const {
  notes, loading, error, showArchived,
  fetchNotes, createNote, updateNote, deleteNote, togglePin, toggleArchive, toggleItem, reorderNotes,
} = useNotes()

const query = ref('')
const activeLabel = ref<string | null>(null)
const busyId = ref<string | null>(null)
const notice = ref<string | null>(null)
const showForm = ref(false)
const editing = ref<Note | null>(null)
const saving = ref(false)
const dragId = ref<string | null>(null)

onMounted(fetchNotes)
watch(showArchived, fetchNotes)

// Drag-reorder only makes sense on the unfiltered active list.
const canReorder = computed(() => !showArchived.value && !query.value.trim() && !activeLabel.value)

function onDragStart(id: string) { dragId.value = id }
async function onDrop(targetId: string) {
  const from = dragId.value
  dragId.value = null
  if (!from || from === targetId) return
  const arr = [...notes.value]
  const fi = arr.findIndex(n => n.id === from)
  const ti = arr.findIndex(n => n.id === targetId)
  if (fi < 0 || ti < 0) return
  const [moved] = arr.splice(fi, 1)
  arr.splice(ti, 0, moved!)
  notes.value = arr
  try { await reorderNotes(arr.map(n => n.id)) }
  catch (e) { flash(e instanceof Error ? e.message : 'Reorder failed'); await fetchNotes() }
}

const labels = computed(() => {
  const set = new Set<string>(notes.value.map(n => n.label || '').filter(Boolean))
  return [...set].sort()
})

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = notes.value
  if (activeLabel.value) list = list.filter(n => n.label === activeLabel.value)
  if (q) {
    list = list.filter(n =>
      n.title.toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q) ||
      (n.items || []).some(i => i.text.toLowerCase().includes(q)),
    )
  }
  return list
})

function openCreate() { editing.value = null; showForm.value = true }
function openEdit(note: Note) { editing.value = note; showForm.value = true }
function closeForm() { showForm.value = false; editing.value = null }

async function onSubmit(payload: NoteCreate) {
  saving.value = true
  try {
    if (editing.value) { await updateNote(editing.value.id, payload); flash('Note updated') }
    else { await createNote(payload); flash('Note created') }
    closeForm()
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Save failed')
  } finally {
    saving.value = false
  }
}

async function withBusy(id: string, fn: () => Promise<void>, msg: string) {
  busyId.value = id
  try { await fn(); flash(msg) }
  catch (e) { flash(e instanceof Error ? e.message : 'Action failed') }
  finally { busyId.value = null }
}

function onPin(id: string) { return withBusy(id, () => togglePin(id), 'Updated') }
function onArchive(id: string) { return withBusy(id, () => toggleArchive(id), showArchived.value ? 'Unarchived' : 'Archived') }
function onItem(id: string, index: number) { return toggleItem(id, index) }
function onRemove(id: string) {
  if (!confirm('Delete this note?')) return
  return withBusy(id, () => deleteNote(id), 'Deleted')
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2500)
}
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <div class="mb-4 flex items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">Notes</h1>
      <div class="flex gap-2">
        <div class="flex rounded-md border border-border p-0.5 text-sm">
          <button class="rounded px-2.5 py-1" :class="!showArchived ? 'bg-panel2 text-fg' : 'text-muted'" @click="showArchived = false">Active</button>
          <button class="rounded px-2.5 py-1" :class="showArchived ? 'bg-panel2 text-fg' : 'text-muted'" @click="showArchived = true">Archived</button>
        </div>
        <button class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50" :disabled="loading" @click="fetchNotes">↻</button>
        <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white" @click="openCreate">+ New</button>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showForm" class="mb-4">
        <NotesNoteForm :note="editing" :saving="saving" @submit="onSubmit" @cancel="closeForm" />
      </div>
    </Transition>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <input v-model="query" type="search" placeholder="Search…" class="min-w-40 flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" >
    </div>
    <div v-if="labels.length" class="mb-4 flex flex-wrap gap-1.5">
      <button class="rounded-full border px-2.5 py-0.5 text-xs" :class="activeLabel === null ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'" @click="activeLabel = null">All</button>
      <button v-for="l in labels" :key="l" class="rounded-full border px-2.5 py-0.5 text-xs" :class="activeLabel === l ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'" @click="activeLabel = l">{{ l }}</button>
    </div>

    <Transition name="fade">
      <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ notice }}</p>
    </Transition>

    <p v-if="error" class="py-8 text-center text-red">{{ error }}</p>
    <p v-else-if="loading && !notes.length" class="py-8 text-center text-muted">Loading…</p>
    <p v-else-if="!visible.length" class="py-8 text-center text-muted">
      No {{ showArchived ? 'archived ' : '' }}notes{{ query || activeLabel ? ' match your filter' : '' }}.
    </p>

    <p v-if="canReorder && visible.length > 1" class="mb-2 text-xs text-muted">Tip: drag cards to reorder.</p>
    <div v-if="!error && (!loading || notes.length) && visible.length" class="columns-1 gap-2.5 sm:columns-2 lg:columns-3">
      <div
        v-for="n in visible"
        :key="n.id"
        class="break-inside-avoid"
        :draggable="canReorder"
        :class="{ 'opacity-50': dragId === n.id }"
        @dragstart="onDragStart(n.id)"
        @dragover.prevent
        @drop="onDrop(n.id)"
      >
        <NotesNoteCard
          :note="n"
          :busy="busyId === n.id"
          @edit="openEdit" @pin="onPin" @archive="onArchive" @remove="onRemove" @toggle-item="onItem"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
