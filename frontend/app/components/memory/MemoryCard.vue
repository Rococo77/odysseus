<script setup lang="ts">
import type { Memory } from '~/types/memory'
import { MEMORY_CATEGORIES } from '~/types/memory'

const props = defineProps<{ memory: Memory; busy?: boolean }>()
const emit = defineEmits<{
  pin: [id: string]
  save: [id: string, text: string, category: string]
  remove: [id: string]
}>()

const editing = ref(false)
const text = ref(props.memory.text)
const category = ref(props.memory.category)

function startEdit() {
  text.value = props.memory.text
  category.value = props.memory.category
  editing.value = true
}
function save() {
  const t = text.value.trim()
  if (!t) return
  emit('save', props.memory.id, t, category.value)
  editing.value = false
}
</script>

<template>
  <article
    class="rounded-card border border-border bg-panel p-3 transition-opacity"
    :class="{ 'opacity-55 pointer-events-none': busy }"
  >
    <div v-if="!editing" class="flex items-start gap-2">
      <button
        class="shrink-0 text-base leading-none"
        :class="memory.pinned ? 'text-amber' : 'text-muted hover:text-fg'"
        title="Pin"
        @click="emit('pin', memory.id)"
      >
        {{ memory.pinned ? '📌' : '📍' }}
      </button>

      <div class="min-w-0 flex-1">
        <p class="whitespace-pre-wrap break-words text-sm text-fg">{{ memory.text }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide" :class="categoryClasses(memory.category)">
            {{ memory.category }}
          </span>
          <span class="text-[11px] text-muted">{{ formatUnix(memory.timestamp) }}</span>
          <span v-if="memory.source && memory.source !== 'user'" class="text-[11px] text-muted">· {{ memory.source }}</span>
        </div>
      </div>

      <div class="flex shrink-0 gap-1">
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent" title="Edit" @click="startEdit">✎</button>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-red" title="Delete" @click="emit('remove', memory.id)">🗑</button>
      </div>
    </div>

    <div v-else class="flex flex-col gap-2">
      <textarea
        v-model="text"
        rows="3"
        class="w-full rounded-md border border-accent bg-panel2 px-2 py-1.5 text-sm text-fg outline-none"
      />
      <div class="flex items-center justify-between gap-2">
        <select v-model="category" class="rounded-md border border-border bg-panel2 px-2 py-1 text-sm text-fg outline-none">
          <option v-for="c in MEMORY_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <div class="flex gap-2">
          <button class="rounded-md border border-border px-3 py-1 text-sm text-fg" @click="editing = false">Cancel</button>
          <button class="rounded-md border border-accent bg-accent px-3 py-1 text-sm text-white disabled:opacity-50" :disabled="!text.trim()" @click="save">Save</button>
        </div>
      </div>
    </div>
  </article>
</template>
