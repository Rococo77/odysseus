<script setup lang="ts">
import type { Session } from '~/types/sessions'

const props = defineProps<{ session: Session; busy?: boolean; active?: boolean }>()
const emit = defineEmits<{
  open: [id: string]
  star: [id: string]
  rename: [id: string, name: string]
  archive: [id: string]
  remove: [id: string]
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
</script>

<template>
  <div class="row" :class="{ busy, active }">
    <button class="star" :class="{ on: session.is_important }" title="Star" @click.stop="emit('star', session.id)">
      {{ session.is_important ? '★' : '☆' }}
    </button>

    <div class="main" @click="emit('open', session.id)">
      <input
        v-if="editing"
        ref="inputEl"
        v-model="draft"
        class="rename"
        @click.stop
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="editing = false"
        @blur="commitRename"
      />
      <span v-else class="name" @dblclick.stop="startRename">{{ session.name || '(untitled)' }}</span>

      <div class="meta">
        <span v-if="session.folder" class="chip folder">{{ session.folder }}</span>
        <span class="chip muted">{{ session.model || '—' }}</span>
        <span class="chip muted">{{ session.message_count }} msg</span>
        <span class="chip muted">{{ formatDateTime(session.last_message_at || session.updated_at) }}</span>
        <span v-if="session.has_documents" class="chip" title="Has documents">📎</span>
        <span v-if="session.has_images" class="chip" title="Has images">🖼</span>
        <span v-if="session.mode && session.mode !== 'chat'" class="chip mode">{{ session.mode }}</span>
      </div>
    </div>

    <div class="actions">
      <button title="Rename" :disabled="busy" @click.stop="startRename">✎</button>
      <button title="Archive" :disabled="busy" @click.stop="emit('archive', session.id)">🗄</button>
      <button class="danger" title="Delete" :disabled="busy" @click.stop="emit('remove', session.id)">🗑</button>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  transition: opacity 0.15s, border-color 0.15s;
}
.row.active { border-color: var(--accent); }
.row.busy { opacity: 0.55; pointer-events: none; }
.star {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 15px;
  line-height: 1;
  padding: 0 0.2rem;
}
.star.on { color: var(--amber); }
.main { flex: 1; min-width: 0; cursor: pointer; }
.name { font-weight: 600; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rename {
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--accent);
  border-radius: 5px;
  color: var(--fg);
  padding: 0.15rem 0.35rem;
  font: inherit;
  font-weight: 600;
}
.meta { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.25rem; }
.chip { font-size: 11px; border: 1px solid var(--border); border-radius: 999px; padding: 0.05rem 0.45rem; }
.chip.muted { color: var(--muted); }
.chip.folder { color: var(--accent); border-color: var(--accent); }
.chip.mode { color: var(--green); border-color: var(--green); text-transform: uppercase; letter-spacing: 0.04em; }
.actions { display: flex; gap: 0.25rem; flex: none; }
.actions button {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--fg);
  padding: 0.2rem 0.4rem;
  line-height: 1;
}
.actions button:hover:not(:disabled) { border-color: var(--accent); }
.actions .danger:hover:not(:disabled) { border-color: var(--red); }
.actions button:disabled { opacity: 0.4; cursor: default; }
</style>
