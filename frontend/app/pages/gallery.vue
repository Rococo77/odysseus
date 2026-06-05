<script setup lang="ts">
import type { GalleryImage, GallerySort } from '~/types/gallery'

// Fifth migrated page (Tailwind). Image library: paginated grid with search,
// tag/model/album/favorites filters and sort; upload, favorite, rename, tag,
// album assign, rotate, delete via a detail modal. (AI tagging, image editor,
// bulk zip/download remain in the legacy app.)
const {
  items, albums, tags, models, total, loading, error, filters, hasMore,
  fetchLibrary, loadMore, setFilters, upload, toggleFavorite, fetchAlbums, createAlbum,
  deleteImage, downloadZip, aiTagBatch,
} = useGallery()

const search = ref(filters.value.search ?? '')
const selected = ref<GalleryImage | null>(null)
const uploading = ref(false)
const notice = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Bulk selection
const selectMode = ref(false)
const picked = ref<string[]>([])
const bulkBusy = ref(false)

onMounted(() => { fetchLibrary(); fetchAlbums() })

function toggleSelect(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter(x => x !== id) : [...picked.value, id]
}
function exitSelect() { selectMode.value = false; picked.value = [] }

async function onDownloadZip() {
  if (!picked.value.length) return
  bulkBusy.value = true
  try { await downloadZip([...picked.value]); flash(`Downloading ${picked.value.length} image(s)`) }
  catch (e) { flash(e instanceof Error ? e.message : 'Download failed') }
  finally { bulkBusy.value = false }
}
async function onBulkDelete() {
  if (!picked.value.length || !confirm(`Delete ${picked.value.length} image(s)?`)) return
  bulkBusy.value = true
  try {
    for (const id of [...picked.value]) await deleteImage(id)
    flash(`Deleted ${picked.value.length}`)
    exitSelect()
  } catch (e) { flash(e instanceof Error ? e.message : 'Delete failed') }
  finally { bulkBusy.value = false }
}
async function onAiTag() {
  try {
    const r = await aiTagBatch(filters.value.album)
    flash(r.queued ? `Queued ${r.queued} for AI tagging (${r.total_untagged} untagged)` : 'Nothing to tag')
  } catch (e) { flash(e instanceof Error ? e.message : 'AI-tag failed') }
}

// Debounced search.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setFilters({ search: v.trim() || undefined }), 300)
})

function toggleTag(tag: string) {
  setFilters({ tag: filters.value.tag === tag ? undefined : tag })
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  uploading.value = true
  try {
    const { uploaded, duplicates } = await upload(input.files)
    flash(`${uploaded} uploaded${duplicates ? `, ${duplicates} duplicate(s) skipped` : ''}`)
  } catch (err) {
    flash(err instanceof Error ? err.message : 'Upload failed')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function onCreateAlbum() {
  const name = prompt('Album name?')?.trim()
  if (!name) return
  await createAlbum(name)
  flash('Album created')
}

function onFavorite(img: GalleryImage) { return toggleFavorite(img) }

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2800)
}
</script>

<template>
  <section class="mx-auto max-w-6xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">Gallery <span class="text-sm font-normal text-muted">{{ total }}</span></h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent" @click="onAiTag">AI-tag</button>
        <button class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent" @click="selectMode ? exitSelect() : (selectMode = true)">{{ selectMode ? 'Cancel' : 'Select' }}</button>
        <button class="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent" @click="onCreateAlbum">+ Album</button>
        <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="uploading" @click="fileInput?.click()">
          {{ uploading ? 'Uploading…' : '⬆ Upload' }}
        </button>
        <input ref="fileInput" type="file" accept="image/*,video/*" multiple class="hidden" @change="onFiles" />
      </div>
    </div>

    <!-- Bulk action bar -->
    <div v-if="selectMode" class="mb-3 flex items-center gap-2 rounded-md border border-accent/40 bg-panel2 px-3 py-1.5 text-sm" :class="{ 'opacity-60 pointer-events-none': bulkBusy }">
      <span class="text-muted">{{ picked.length }} selected</span>
      <button class="ml-auto rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent disabled:opacity-50" :disabled="!picked.length" @click="onDownloadZip">Download ZIP</button>
      <button class="rounded-md border border-border px-2.5 py-1 text-xs text-red hover:border-red disabled:opacity-50" :disabled="!picked.length" @click="onBulkDelete">Delete</button>
    </div>

    <!-- Toolbar -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <input v-model="search" type="search" placeholder="Search prompt or tags…" class="min-w-48 flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />
      <select :value="filters.sort" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" @change="setFilters({ sort: ($event.target as HTMLSelectElement).value as GallerySort })">
        <option value="recent">Recent</option>
        <option value="oldest">Oldest</option>
        <option value="shuffle">Shuffle</option>
      </select>
      <select v-if="models.length" :value="filters.model ?? ''" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" @change="setFilters({ model: ($event.target as HTMLSelectElement).value || undefined })">
        <option value="">All models</option>
        <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
      </select>
      <select v-if="albums.length" :value="filters.album ?? ''" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" @change="setFilters({ album: ($event.target as HTMLSelectElement).value || undefined })">
        <option value="">All albums</option>
        <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }} ({{ a.count }})</option>
      </select>
      <button
        class="rounded-md border px-2.5 py-1.5 text-sm"
        :class="filters.favorites ? 'border-amber text-amber' : 'border-border text-muted hover:text-fg'"
        @click="setFilters({ favorites: !filters.favorites })"
      >★ Favorites</button>
    </div>

    <div v-if="tags.length" class="mb-4 flex flex-wrap gap-1.5">
      <button
        v-for="t in tags"
        :key="t"
        class="rounded-full border px-2.5 py-0.5 text-xs"
        :class="filters.tag === t ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'"
        @click="toggleTag(t)"
      >{{ t }}</button>
    </div>

    <Transition name="fade">
      <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ notice }}</p>
    </Transition>

    <p v-if="error" class="py-10 text-center text-red">{{ error }}</p>
    <p v-else-if="loading && !items.length" class="py-10 text-center text-muted">Loading…</p>
    <p v-else-if="!items.length" class="py-10 text-center text-muted">No images.</p>

    <div v-else class="columns-2 gap-2.5 sm:columns-3 lg:columns-4">
      <GalleryImageCard
        v-for="img in items"
        :key="img.id"
        :image="img"
        :selectable="selectMode"
        :selected="picked.includes(img.id)"
        @open="selected = $event"
        @favorite="onFavorite"
        @toggle-select="toggleSelect"
      />
    </div>

    <div v-if="hasMore" class="mt-4 flex justify-center">
      <button class="rounded-md border border-border px-4 py-2 text-sm hover:border-accent disabled:opacity-50" :disabled="loading" @click="loadMore">
        {{ loading ? 'Loading…' : 'Load more' }}
      </button>
    </div>

    <GalleryImageDetail v-if="selected" :image="selected" @close="selected = null" />
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
