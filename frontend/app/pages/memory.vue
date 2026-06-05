<script setup lang="ts">
import { MEMORY_CATEGORIES } from '~/types/memory'

// Flat CRUD over /api/memory (list, create, inline edit, pin, delete, search,
// category filter, sort) plus parity tools: audit/dedup, and extract/import
// suggestions from a session or a file.
const {
  memories, loading, error,
  fetchMemories, createMemory, updateMemory, deleteMemory, togglePin,
  audit, extractFromSession, importFile,
} = useMemory()
const { sessions, fetchSessions } = useSessions()

const query = ref('')
const activeCategory = ref<string | null>(null)
const sortNewest = ref(true)
const busyId = ref<string | null>(null)
const notice = ref<string | null>(null)

// New-memory form
const draftText = ref('')
const draftCategory = ref('fact')
const creating = ref(false)

// Parity tools
const toolSession = ref('')
const toolsBusy = ref(false)
const suggestions = ref<string[]>([])
const pickedSug = ref<string[]>([])
const sugCategory = ref('fact')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => { fetchMemories(); fetchSessions() })

async function onAudit() {
  toolsBusy.value = true
  try {
    const r = await audit()
    flash(r.removed > 0 ? `Audit removed ${r.removed} duplicate(s)` : 'Already tidy')
  } catch (e) { flash(e instanceof Error ? e.message : 'Audit failed') }
  finally { toolsBusy.value = false }
}

async function runSuggest(fn: () => Promise<string[]>) {
  if (!toolSession.value) { flash('Pick a session first (for model config)'); return }
  toolsBusy.value = true
  try {
    const s = await fn()
    suggestions.value = s
    pickedSug.value = [...s]
    if (!s.length) flash('No suggestions found')
  } catch (e) { flash(e instanceof Error ? e.message : 'Failed') }
  finally { toolsBusy.value = false }
}

function onExtract() { return runSuggest(() => extractFromSession(toolSession.value)) }
function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  return runSuggest(() => importFile(toolSession.value, file))
}

function toggleSug(s: string) {
  pickedSug.value = pickedSug.value.includes(s) ? pickedSug.value.filter(x => x !== s) : [...pickedSug.value, s]
}

async function addSelected() {
  const chosen = suggestions.value.filter(s => pickedSug.value.includes(s))
  if (!chosen.length) return
  toolsBusy.value = true
  try {
    for (const text of chosen) await createMemory(text, sugCategory.value)
    flash(`Added ${chosen.length} memory(ies)`)
    suggestions.value = []
    pickedSug.value = []
  } catch (e) { flash(e instanceof Error ? e.message : 'Add failed') }
  finally { toolsBusy.value = false }
}

const categories = computed(() => {
  const set = new Set<string>(memories.value.map(m => m.category).filter(Boolean))
  return [...set].sort()
})

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = memories.value
  if (q) list = list.filter(m => m.text.toLowerCase().includes(q))
  if (activeCategory.value) list = list.filter(m => m.category === activeCategory.value)
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return sortNewest.value ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
  })
})

async function onCreate() {
  const t = draftText.value.trim()
  if (!t) return
  creating.value = true
  try {
    await createMemory(t, draftCategory.value)
    draftText.value = ''
    flash('Memory added')
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Create failed')
  } finally {
    creating.value = false
  }
}

async function withBusy(id: string, fn: () => Promise<void>, msg: string) {
  busyId.value = id
  try { await fn(); flash(msg) }
  catch (e) { flash(e instanceof Error ? e.message : 'Action failed') }
  finally { busyId.value = null }
}

function onPin(id: string) { return withBusy(id, () => togglePin(id), 'Updated') }
function onSave(id: string, text: string, category: string) { return withBusy(id, () => updateMemory(id, text, category), 'Saved') }
function onRemove(id: string) {
  if (!confirm('Delete this memory?')) return
  return withBusy(id, () => deleteMemory(id), 'Deleted')
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2500)
}
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Memory</h1>
      <button class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50" :disabled="loading" @click="fetchMemories">↻ Refresh</button>
    </div>

    <!-- Create -->
    <form class="mb-4 rounded-card border border-border bg-panel p-3" @submit.prevent="onCreate">
      <textarea
        v-model="draftText"
        rows="2"
        placeholder="Remember something… (e.g. “Prefers dark mode”)"
        class="w-full resize-y rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm text-fg outline-none focus:border-accent"
      />
      <div class="mt-2 flex items-center justify-between gap-2">
        <select v-model="draftCategory" class="rounded-md border border-border bg-panel2 px-2 py-1 text-sm text-fg outline-none focus:border-accent">
          <option v-for="c in MEMORY_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <button type="submit" class="rounded-md border border-accent bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50" :disabled="!draftText.trim() || creating">
          {{ creating ? 'Adding…' : '+ Add' }}
        </button>
      </div>
    </form>

    <!-- Tools: audit / extract / import -->
    <div class="mb-4 rounded-card border border-border bg-panel p-3" :class="{ 'opacity-60 pointer-events-none': toolsBusy }">
      <div class="flex flex-wrap items-center gap-2">
        <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="onAudit">Audit / dedup</button>
        <span class="text-xs text-muted">·</span>
        <select v-model="toolSession" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
          <option value="">Pick a session…</option>
          <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name || '(untitled)' }}</option>
        </select>
        <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent disabled:opacity-50" :disabled="!toolSession" @click="onExtract">Extract</button>
        <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent disabled:opacity-50" :disabled="!toolSession" @click="fileInput?.click()">Import file</button>
        <input ref="fileInput" type="file" accept=".txt,.md,.pdf,.csv,.log,.json,.py,.js,.html" class="hidden" @change="onImportFile" />
      </div>

      <!-- Suggestions review -->
      <div v-if="suggestions.length" class="mt-3 border-t border-border pt-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs text-muted">{{ pickedSug.length }}/{{ suggestions.length }} selected</span>
          <div class="flex items-center gap-2">
            <select v-model="sugCategory" class="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-fg outline-none focus:border-accent">
              <option v-for="c in MEMORY_CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
            <button class="rounded-md border border-accent bg-accent px-3 py-1 text-xs text-white disabled:opacity-50" :disabled="!pickedSug.length" @click="addSelected">Add selected</button>
            <button class="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-fg" @click="suggestions = []; pickedSug = []">Dismiss</button>
          </div>
        </div>
        <ul class="flex max-h-60 flex-col gap-1 overflow-auto">
          <li v-for="(s, i) in suggestions" :key="i" class="flex items-start gap-2 text-sm">
            <input type="checkbox" class="mt-1 accent-accent" :checked="pickedSug.includes(s)" @change="toggleSug(s)" />
            <span :class="pickedSug.includes(s) ? 'text-fg' : 'text-muted'">{{ s }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <input v-model="query" type="search" placeholder="Search…" class="min-w-40 flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />
      <button class="rounded-md border border-border px-2.5 py-1.5 text-sm hover:border-accent" @click="sortNewest = !sortNewest">
        {{ sortNewest ? 'Newest' : 'Oldest' }}
      </button>
    </div>
    <div v-if="categories.length" class="mb-4 flex flex-wrap gap-1.5">
      <button
        class="rounded-full border px-2.5 py-0.5 text-xs"
        :class="activeCategory === null ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'"
        @click="activeCategory = null"
      >All</button>
      <button
        v-for="c in categories"
        :key="c"
        class="rounded-full border px-2.5 py-0.5 text-xs"
        :class="activeCategory === c ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'"
        @click="activeCategory = c"
      >{{ c }}</button>
    </div>

    <Transition name="fade">
      <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ notice }}</p>
    </Transition>

    <p v-if="error" class="py-8 text-center text-red">{{ error }}</p>
    <p v-else-if="loading && !memories.length" class="py-8 text-center text-muted">Loading…</p>
    <p v-else-if="!visible.length" class="py-8 text-center text-muted">No memories{{ query || activeCategory ? ' match your filter' : ' yet' }}.</p>

    <div v-else class="flex flex-col gap-2.5">
      <MemoryMemoryCard
        v-for="m in visible"
        :key="m.id"
        :memory="m"
        :busy="busyId === m.id"
        @pin="onPin" @save="onSave" @remove="onRemove"
      />
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
