<script setup lang="ts">
import type { GalleryImage } from '~/types/gallery'

const props = defineProps<{ image: GalleryImage }>()
const emit = defineEmits<{ close: []; edit: [img: GalleryImage] }>()

const { mediaUrl } = useApi()
const { albums, patchImage, rename, rotate, deleteImage } = useGallery()

const src = computed(() => mediaUrl(props.image.url))
const name = ref(props.image.prompt || '')
const tags = ref(props.image.tags || '')
const albumId = ref(props.image.album_id || '')
const busy = ref(false)

async function run(fn: () => Promise<unknown>) {
  busy.value = true
  try { await fn() } finally { busy.value = false }
}

const saveName = () => run(async () => {
  const n = name.value.trim()
  if (n && n !== props.image.prompt) await rename(props.image.id, n)
})
const saveTags = () => run(() => patchImage(props.image.id, { tags: tags.value }))
const saveAlbum = () => run(() => patchImage(props.image.id, { album_id: albumId.value || null }))
const onRotate = (angle: 90 | -90 | 180) => run(() => rotate(props.image.id, angle))
const onDelete = () => {
  if (!confirm('Delete this image?')) return
  return run(async () => { await deleteImage(props.image.id); emit('close') })
}

const aiTags = computed(() => (props.image.ai_tags || '').split(',').map(t => t.trim()).filter(Boolean))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="emit('close')">
    <div class="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-card border border-border bg-panel" :class="{ 'opacity-60 pointer-events-none': busy }">
      <!-- Image -->
      <div class="flex min-w-0 flex-1 items-center justify-center bg-black/40 p-2">
        <img :src="src" :alt="image.prompt || image.filename" class="max-h-[86vh] max-w-full object-contain" >
      </div>

      <!-- Side panel -->
      <div class="flex w-72 shrink-0 flex-col gap-3 overflow-auto border-l border-border p-3 text-sm">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Details</h3>
          <button class="text-muted hover:text-fg" @click="emit('close')">✕</button>
        </div>

        <label class="flex flex-col gap-1 text-xs text-muted">
          <span>Name</span>
          <input v-model="name" class="rounded-md border border-border bg-panel2 px-2 py-1 text-sm text-fg outline-none focus:border-accent" @blur="saveName" @keydown.enter="saveName" >
        </label>

        <label class="flex flex-col gap-1 text-xs text-muted">
          <span>Tags (comma-separated)</span>
          <input v-model="tags" placeholder="e.g. landscape, blue" class="rounded-md border border-border bg-panel2 px-2 py-1 text-sm text-fg outline-none focus:border-accent" @blur="saveTags" @keydown.enter="saveTags" >
        </label>

        <div v-if="aiTags.length" class="flex flex-col gap-1 text-xs text-muted">
          <span>AI tags</span>
          <div class="flex flex-wrap gap-1">
            <span v-for="t in aiTags" :key="t" class="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">{{ t }}</span>
          </div>
        </div>

        <label v-if="albums.length" class="flex flex-col gap-1 text-xs text-muted">
          <span>Album</span>
          <select v-model="albumId" class="rounded-md border border-border bg-panel2 px-2 py-1 text-sm text-fg outline-none focus:border-accent" @change="saveAlbum">
            <option value="">— None —</option>
            <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>

        <div class="flex flex-col gap-1 text-xs text-muted">
          <span>Rotate</span>
          <div class="flex gap-1">
            <button class="flex-1 rounded-md border border-border bg-panel2 py-1 text-fg hover:border-accent" @click="onRotate(-90)">⟲ 90°</button>
            <button class="flex-1 rounded-md border border-border bg-panel2 py-1 text-fg hover:border-accent" @click="onRotate(90)">⟳ 90°</button>
            <button class="flex-1 rounded-md border border-border bg-panel2 py-1 text-fg hover:border-accent" @click="onRotate(180)">180°</button>
          </div>
        </div>

        <dl class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <dt>Model</dt><dd class="text-fg/80">{{ image.model || '—' }}</dd>
          <dt>Size</dt><dd class="text-fg/80">{{ image.width && image.height ? `${image.width}×${image.height}` : '—' }}</dd>
          <dt v-if="image.camera">Camera</dt><dd v-if="image.camera" class="text-fg/80">{{ image.camera }}</dd>
          <dt>Created</dt><dd class="text-fg/80">{{ formatDateTime(image.created_at) }}</dd>
        </dl>

        <button class="mt-auto rounded-md border border-accent px-3 py-1.5 text-accent hover:bg-accent/10" @click="emit('edit', image)">Edit image…</button>
        <button class="rounded-md border border-red px-3 py-1.5 text-red hover:bg-red/10" @click="onDelete">Delete</button>
      </div>
    </div>
  </div>
</template>
