<script setup lang="ts">
import { MEMORY_CATEGORIES } from '~/types/memory'

// Third migrated page — first one styled with Tailwind. Flat CRUD over
// /api/memory: list, create, inline edit, pin, delete, with text search,
// category filter and newest/oldest sort.
const {
  memories, loading, error,
  fetchMemories, createMemory, updateMemory, deleteMemory, togglePin,
} = useMemory()

const query = ref('')
const activeCategory = ref<string | null>(null)
const sortNewest = ref(true)
const busyId = ref<string | null>(null)
const notice = ref<string | null>(null)

// New-memory form
const draftText = ref('')
const draftCategory = ref('fact')
const creating = ref(false)

onMounted(fetchMemories)

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
