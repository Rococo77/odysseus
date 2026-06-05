<script setup lang="ts">
import type { Session } from '~/types/sessions'

const props = defineProps<{ session: Session; busy?: boolean; active?: boolean; selectable?: boolean; selected?: boolean }>()
const emit = defineEmits<{
  open: [id: string]
  star: [id: string]
  rename: [id: string, name: string]
  archive: [id: string]
  remove: [id: string]
  toggleSelect: [id: string]
}>()

const editing = ref(false)
const draft = ref(props.session.name)

function startRename() {
  draft.value = props.session.name
  editing.value = true
  nextTick(() => inputEl.value?.focus())
}
const inputEl = ref<HTMLInputElement | null>(null)

function commitRename() {
  if (!editing.value) return
  editing.value = false
  const name = draft.value.trim()
  if (name && name !== props.session.name) emit('rename', props.session.id, name)
}

const chip = 'rounded-full border border-border px-1.5 py-0.5 text-[11px]'
const actionBtn = 'rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent disabled:opacity-40'
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-lg border bg-panel px-2.5 py-2 transition-colors"
    :class="[active ? 'border-accent' : 'border-border', busy ? 'opacity-55 pointer-events-none' : '']"
  >
    <input
      v-if="selectable"
      type="checkbox"
      class="shrink-0 accent-accent"
      :checked="selected"
      @click.stop="emit('toggleSelect', session.id)"
    >
    <button
      class="shrink-0 px-0.5 text-[15px] leading-none"
      :class="session.is_important ? 'text-amber' : 'text-muted hover:text-fg'"
      title="Star"
      @click.stop="emit('star', session.id)"
    >{{ session.is_important ? '★' : '☆' }}</button>

    <div class="min-w-0 flex-1 cursor-pointer" @click="emit('open', session.id)">
      <input
        v-if="editing"
        ref="inputEl"
        v-model="draft"
        class="w-full rounded-[5px] border border-accent bg-panel2 px-1.5 py-0.5 text-sm font-semibold text-fg outline-none"
        @click.stop
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="editing = false"
        @blur="commitRename"
      >
      <span v-else class="block truncate font-semibold" @dblclick.stop="startRename">{{ session.name || '(untitled)' }}</span>

      <div class="mt-1 flex flex-wrap gap-1.5">
        <span v-if="session.folder" :class="[chip, 'border-accent text-accent']">{{ session.folder }}</span>
        <span :class="[chip, 'text-muted']">{{ session.model || '—' }}</span>
        <span :class="[chip, 'text-muted']">{{ session.message_count }} msg</span>
        <span :class="[chip, 'text-muted']">{{ formatDateTime(session.last_message_at || session.updated_at) }}</span>
        <span v-if="session.has_documents" :class="chip" title="Has documents">📎</span>
        <span v-if="session.has_images" :class="chip" title="Has images">🖼</span>
        <span v-if="session.mode && session.mode !== 'chat'" :class="[chip, 'border-green text-green uppercase tracking-wide']">{{ session.mode }}</span>
      </div>
    </div>

    <div class="flex shrink-0 gap-1">
      <button :class="actionBtn" title="Rename" :disabled="busy" @click.stop="startRename">✎</button>
      <button :class="actionBtn" title="Archive" :disabled="busy" @click.stop="emit('archive', session.id)">🗄</button>
      <button :class="[actionBtn, 'hover:border-red']" title="Delete" :disabled="busy" @click.stop="emit('remove', session.id)">🗑</button>
    </div>
  </div>
</template>
