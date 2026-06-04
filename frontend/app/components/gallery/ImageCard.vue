<script setup lang="ts">
import type { GalleryImage } from '~/types/gallery'

const props = defineProps<{ image: GalleryImage }>()
const emit = defineEmits<{ open: [img: GalleryImage]; favorite: [img: GalleryImage] }>()

const { mediaUrl } = useApi()
const src = computed(() => mediaUrl(props.image.url))
</script>

<template>
  <div class="group relative mb-2.5 break-inside-avoid overflow-hidden rounded-card border border-border bg-panel2">
    <img
      :src="src"
      :alt="image.prompt || image.filename"
      loading="lazy"
      class="w-full cursor-pointer object-cover transition-transform group-hover:scale-[1.02]"
      @click="emit('open', image)"
    />
    <button
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
