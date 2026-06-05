<script setup lang="ts">
import type { GalleryImage } from '~/types/gallery'

const props = defineProps<{ image: GalleryImage; selectable?: boolean; selected?: boolean }>()
const emit = defineEmits<{
  open: [img: GalleryImage]
  favorite: [img: GalleryImage]
  toggleSelect: [id: string]
}>()

const { mediaUrl } = useApi()
const src = computed(() => mediaUrl(props.image.url))

function onClick() {
  if (props.selectable) emit('toggleSelect', props.image.id)
  else emit('open', props.image)
}
</script>

<template>
  <div class="group relative mb-2.5 break-inside-avoid overflow-hidden rounded-card border bg-panel2" :class="selected ? 'border-accent' : 'border-border'">
    <img
      :src="src"
      :alt="image.prompt || image.filename"
      loading="lazy"
      class="w-full cursor-pointer object-cover transition-transform group-hover:scale-[1.02]"
      :class="{ 'opacity-70': selectable && !selected }"
      @click="onClick"
    >
    <span v-if="selectable" class="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-xs" :class="selected ? 'border-accent bg-accent text-white' : 'border-white/70 bg-black/40 text-transparent'">✓</span>
    <button
      v-if="!selectable"
      class="absolute right-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-sm leading-none backdrop-blur"
      :class="image.favorite ? 'text-amber' : 'text-white/80 hover:text-white'"
      title="Favorite"
      @click.stop="emit('favorite', image)"
    >{{ image.favorite ? '★' : '☆' }}</button>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[11px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
      {{ image.prompt || image.filename }}
    </div>
  </div>
</template>
