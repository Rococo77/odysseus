<script setup lang="ts">
import type { Note, NoteCreate, NoteType, NoteItem, NoteRepeat } from '~/types/notes'
import { NOTE_COLORS } from '~/utils/notes'

const props = defineProps<{ note?: Note | null; saving?: boolean }>()
const emit = defineEmits<{
  submit: [payload: NoteCreate]
  cancel: []
}>()

const title = ref(props.note?.title ?? '')
const content = ref(props.note?.content ?? '')
const noteType = ref<NoteType>(props.note?.note_type ?? 'note')
const label = ref(props.note?.label ?? '')
const color = ref<string | null>(props.note?.color ?? null)
const dueDate = ref(props.note?.due_date ?? '')
const repeat = ref<NoteRepeat>(props.note?.repeat ?? 'none')
const REPEATS: NoteRepeat[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']
const items = ref<NoteItem[]>(props.note?.items ? props.note.items.map(i => ({ ...i })) : [{ text: '', done: false }])

function addItem() { items.value.push({ text: '', done: false }) }
function removeItem(i: number) { items.value.splice(i, 1) }

const canSubmit = computed(() => {
  if (noteType.value === 'checklist') return items.value.some(i => i.text.trim())
  return title.value.trim().length > 0 || content.value.trim().length > 0
})

function onSubmit() {
  if (!canSubmit.value) return
  const payload: NoteCreate = {
    title: title.value.trim(),
    note_type: noteType.value,
    label: label.value.trim() || null,
    color: color.value,
    due_date: dueDate.value || null,
    repeat: repeat.value,
  }
  if (noteType.value === 'checklist') {
    payload.items = items.value.filter(i => i.text.trim()).map(i => ({ text: i.text.trim(), done: i.done }))
    payload.content = null
  } else {
    payload.content = content.value
    payload.items = null
  }
  emit('submit', payload)
}
</script>

<template>
  <form class="rounded-card border border-border bg-panel p-4" @submit.prevent="onSubmit">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="font-semibold">{{ props.note ? 'Edit note' : 'New note' }}</h3>
      <div class="flex rounded-md border border-border p-0.5 text-xs">
        <button type="button" class="rounded px-2 py-1" :class="noteType === 'note' ? 'bg-panel2 text-fg' : 'text-muted'" @click="noteType = 'note'">Note</button>
        <button type="button" class="rounded px-2 py-1" :class="noteType === 'checklist' ? 'bg-panel2 text-fg' : 'text-muted'" @click="noteType = 'checklist'">Checklist</button>
      </div>
    </div>

    <input
      v-model="title"
      type="text"
      placeholder="Title"
      class="mb-2 w-full rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm font-medium text-fg outline-none focus:border-accent"
    >

    <textarea
      v-if="noteType === 'note'"
      v-model="content"
      rows="4"
      placeholder="Take a note…"
      class="mb-2 w-full resize-y rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm text-fg outline-none focus:border-accent"
    />

    <div v-else class="mb-2 flex flex-col gap-1.5">
      <div v-for="(item, i) in items" :key="i" class="flex items-center gap-2">
        <input v-model="item.done" type="checkbox" class="accent-accent" >
        <input
          v-model="item.text"
          type="text"
          placeholder="List item"
          class="flex-1 rounded-md border border-border bg-panel2 px-2 py-1 text-sm text-fg outline-none focus:border-accent"
          @keydown.enter.prevent="addItem"
        >
        <button type="button" class="text-muted hover:text-red" title="Remove" @click="removeItem(i)">✕</button>
      </div>
      <button type="button" class="self-start text-xs text-accent hover:underline" @click="addItem">+ Add item</button>
    </div>

    <div class="mb-3 grid grid-cols-3 gap-2">
      <input v-model="label" type="text" placeholder="Label" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" >
      <input v-model="dueDate" type="date" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" >
      <select v-model="repeat" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" title="Repeat">
        <option v-for="r in REPEATS" :key="r" :value="r">{{ r === 'none' ? 'No repeat' : r }}</option>
      </select>
    </div>

    <div class="mb-4 flex items-center gap-1.5">
      <span class="text-xs text-muted">Color:</span>
      <button
        v-for="c in NOTE_COLORS"
        :key="c.label"
        type="button"
        class="h-5 w-5 rounded-full border"
        :class="color === c.value ? 'border-accent ring-1 ring-accent' : 'border-border'"
        :style="c.value ? { backgroundColor: c.value } : { backgroundColor: 'var(--color-panel2)' }"
        :title="c.label"
        @click="color = c.value"
      />
    </div>

    <div class="flex justify-end gap-2">
      <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm text-fg" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="rounded-md border border-accent bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50" :disabled="!canSubmit || saving">
        {{ saving ? 'Saving…' : props.note ? 'Save' : 'Create' }}
      </button>
    </div>
  </form>
</template>
