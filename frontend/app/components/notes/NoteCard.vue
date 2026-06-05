<script setup lang="ts">
import type { Note } from '~/types/notes'

const props = defineProps<{ note: Note; busy?: boolean }>()
const emit = defineEmits<{
  edit: [note: Note]
  pin: [id: string]
  archive: [id: string]
  remove: [id: string]
  toggleItem: [id: string, index: number]
}>()

const progress = computed(() => checklistProgress(props.note))
const cardStyle = computed(() => (props.note.color ? { backgroundColor: props.note.color } : undefined))
</script>

<template>
  <article
    class="mb-2.5 break-inside-avoid rounded-card border border-border bg-panel p-3 transition-opacity"
    :class="{ 'opacity-55 pointer-events-none': busy }"
    :style="cardStyle"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <h3 v-if="note.title" class="truncate font-semibold text-fg">{{ note.title }}</h3>
      </div>
      <button
        class="shrink-0 leading-none"
        :class="note.pinned ? 'text-amber' : 'text-muted hover:text-fg'"
        title="Pin"
        @click="emit('pin', note.id)"
      >{{ note.pinned ? '📌' : '📍' }}</button>
    </div>

    <!-- Checklist -->
    <ul v-if="note.note_type === 'checklist' && note.items?.length" class="mt-2 flex flex-col gap-1">
      <li v-for="(item, i) in note.items" :key="i" class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="item.done"
          class="accent-accent"
          @change="emit('toggleItem', note.id, i)"
        >
        <span :class="item.done ? 'text-muted line-through' : 'text-fg'">{{ item.text }}</span>
      </li>
    </ul>

    <!-- Plain note content -->
    <p v-else-if="note.content" class="mt-1.5 whitespace-pre-wrap break-words text-sm text-fg/90">{{ note.content }}</p>

    <!-- Meta -->
    <div class="mt-2.5 flex flex-wrap items-center gap-2">
      <span v-if="note.label" class="rounded-full border border-accent px-2 py-0.5 text-[11px] text-accent">{{ note.label }}</span>
      <span v-if="progress.total" class="text-[11px] text-muted">{{ progress.done }}/{{ progress.total }}</span>
      <span v-if="note.due_date" class="rounded-full border border-amber px-2 py-0.5 text-[11px] text-amber">⏰ {{ note.due_date }}</span>
      <span v-if="note.repeat && note.repeat !== 'none'" class="text-[11px] text-muted">↻ {{ note.repeat }}</span>

      <span class="ml-auto flex gap-1">
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent" title="Edit" @click="emit('edit', note)">✎</button>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent" :title="note.archived ? 'Unarchive' : 'Archive'" @click="emit('archive', note.id)">🗄</button>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-red" title="Delete" @click="emit('remove', note.id)">🗑</button>
      </span>
    </div>
  </article>
</template>
