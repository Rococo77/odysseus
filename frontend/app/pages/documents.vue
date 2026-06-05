<script setup lang="ts">
import type { DocumentSummary, DocumentFull } from '~/types/documents'
import { DOC_LANGUAGES } from '~/types/documents'

// Documents: a searchable library on the left, a simple editor on the right.
const { fetchLibrary, getDocument, createDocument, saveContent, patchMeta, deleteDocument, archiveDocument } = useDocuments()

const docs = ref<DocumentSummary[]>([])
const total = ref(0)
const search = ref('')
const language = ref('')
const sort = ref('recent')
const showArchived = ref(false)
const listLoading = ref(false)
const notice = ref<string | null>(null)

// Editor state
const current = ref<DocumentFull | null>(null)
const draft = ref('')
const dirty = ref(false)
const saving = ref(false)
const preview = ref(false)

const hasMore = computed(() => docs.value.length < total.value)
const isMarkdown = computed(() => current.value?.language === 'markdown')

async function loadList(reset = true) {
  listLoading.value = true
  try {
    const offset = reset ? 0 : docs.value.length
    const res = await fetchLibrary({ search: search.value.trim() || undefined, language: language.value || undefined, sort: sort.value, offset, archived: showArchived.value })
    docs.value = reset ? res.documents : [...docs.value, ...res.documents]
    total.value = res.total
  } catch (e) { flash(e instanceof Error ? e.message : 'Failed to load documents') }
  finally { listLoading.value = false }
}

onMounted(() => loadList(true))
let t: ReturnType<typeof setTimeout> | undefined
watch([search, language, sort, showArchived], () => { clearTimeout(t); t = setTimeout(() => loadList(true), 300) })

async function open(id: string) {
  if (dirty.value && !confirm('Discard unsaved changes?')) return
  try {
    current.value = await getDocument(id)
    draft.value = current.value.current_content
    dirty.value = false
    preview.value = false
  } catch (e) { flash(e instanceof Error ? e.message : 'Failed to open') }
}

async function onNew() {
  try {
    const doc = await createDocument({ title: 'Untitled', content: '', language: 'markdown' })
    current.value = doc
    draft.value = ''
    dirty.value = false
    await loadList(true)
  } catch (e) { flash(e instanceof Error ? e.message : 'Create failed') }
}

async function onSave() {
  if (!current.value) return
  saving.value = true
  try {
    current.value = await saveContent(current.value.id, draft.value)
    dirty.value = false
    await loadList(true)
    flash('Saved')
  } catch (e) { flash(e instanceof Error ? e.message : 'Save failed') }
  finally { saving.value = false }
}

async function onMeta() {
  if (!current.value) return
  try {
    current.value = await patchMeta(current.value.id, { title: current.value.title, language: current.value.language })
    await loadList(true)
  } catch (e) { flash(e instanceof Error ? e.message : 'Update failed') }
}

async function onDelete() {
  if (!current.value || !confirm('Delete this document?')) return
  try {
    await deleteDocument(current.value.id)
    current.value = null
    await loadList(true)
    flash('Deleted')
  } catch (e) { flash(e instanceof Error ? e.message : 'Delete failed') }
}

async function onArchive() {
  if (!current.value) return
  try {
    const r = await archiveDocument(current.value.id, !current.value.archived)
    current.value.archived = r.archived
    await loadList(true)
    flash(r.archived ? 'Archived' : 'Unarchived')
  } catch (e) { flash(e instanceof Error ? e.message : 'Archive failed') }
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2500)
}

const field = 'rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent'
</script>

<template>
  <section class="mx-auto grid h-[calc(100vh-120px)] max-w-6xl grid-cols-[300px_1fr] gap-3">
    <!-- Library -->
    <aside class="flex flex-col overflow-hidden rounded-card border border-border bg-panel">
      <div class="flex flex-col gap-2 border-b border-border p-2">
        <div class="flex gap-2">
          <input v-model="search" type="search" placeholder="Search…" :class="[field, 'flex-1']" />
          <button class="rounded-md border border-accent bg-accent px-2.5 py-1.5 text-sm text-white" @click="onNew">+ New</button>
        </div>
        <div class="flex gap-2">
          <select v-model="language" :class="[field, 'flex-1']">
            <option value="">All languages</option>
            <option v-for="l in DOC_LANGUAGES" :key="l" :value="l">{{ l }}</option>
          </select>
          <select v-model="sort" :class="field">
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="edits">Most edits</option>
            <option value="alpha">A–Z</option>
          </select>
        </div>
        <label class="flex items-center gap-1.5 text-xs text-muted"><input v-model="showArchived" type="checkbox" class="accent-accent" /> Archived</label>
      </div>
      <div class="flex-1 overflow-auto p-1.5">
        <button
          v-for="d in docs"
          :key="d.id"
          class="mb-1 block w-full rounded-md px-2 py-1.5 text-left"
          :class="current?.id === d.id ? 'bg-panel2' : 'hover:bg-panel2'"
          @click="open(d.id)"
        >
          <span class="block truncate text-sm text-fg">{{ d.title || 'Untitled' }}</span>
          <span class="text-[11px] text-muted">{{ d.language || 'text' }} · v{{ d.version_count }} · {{ formatDateTime(d.updated_at) }}</span>
        </button>
        <button v-if="hasMore" class="mt-1 w-full rounded-md border border-border py-1 text-xs text-muted hover:border-accent" :disabled="listLoading" @click="loadList(false)">Load more</button>
        <p v-if="!docs.length && !listLoading" class="p-4 text-center text-sm text-muted">No documents.</p>
      </div>
    </aside>

    <!-- Editor -->
    <div class="flex flex-col overflow-hidden rounded-card border border-border bg-panel">
      <div v-if="!current" class="flex flex-1 items-center justify-center text-muted">Select or create a document.</div>
      <template v-else>
        <div class="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <input v-model="current.title" :class="[field, 'min-w-40 flex-1 font-medium']" placeholder="Title" @change="onMeta" />
          <select v-model="current.language" :class="field" @change="onMeta">
            <option v-for="l in DOC_LANGUAGES" :key="l" :value="l">{{ l }}</option>
          </select>
          <button v-if="isMarkdown" class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="preview = !preview">{{ preview ? 'Edit' : 'Preview' }}</button>
          <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="saving || !dirty" @click="onSave">{{ dirty ? 'Save' : 'Saved' }}</button>
          <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="onArchive">{{ current.archived ? 'Unarchive' : 'Archive' }}</button>
          <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-red hover:border-red" @click="onDelete">Delete</button>
        </div>
        <div class="min-h-0 flex-1 overflow-auto">
          <div v-if="preview && isMarkdown" class="md p-4 text-sm leading-relaxed text-fg" v-html="renderMarkdown(draft)" />
          <textarea
            v-else
            v-model="draft"
            class="h-full w-full resize-none bg-bg p-4 font-mono text-[13px] text-fg outline-none"
            spellcheck="false"
            @input="dirty = true"
          />
        </div>
        <div class="border-t border-border px-3 py-1 text-[11px] text-muted">v{{ current.version_count }} · {{ dirty ? 'unsaved changes' : 'up to date' }}</div>
      </template>
    </div>

    <Transition name="fade">
      <p v-if="notice" class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ notice }}</p>
    </Transition>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.md :deep(pre) { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; padding: 0.6rem; overflow: auto; }
.md :deep(code) { font-family: 'FiraCode', ui-monospace, monospace; }
.md :deep(h1), .md :deep(h2), .md :deep(h3) { font-weight: 600; margin: 0.6rem 0 0.3rem; }
.md :deep(a) { color: var(--color-accent); text-decoration: underline; }
.md :deep(ul), .md :deep(ol) { padding-left: 1.2rem; }
</style>
