<script setup lang="ts">
import type { DisplayMessage } from '~/types/chat'

const props = defineProps<{ message: DisplayMessage }>()
const { mediaUrl } = useApi()
const { streaming, deleteMessage, editMessage, regenerate } = useChat()

const html = computed(() => renderMarkdown(props.message.content))
const isUser = computed(() => props.message.role === 'user')
// Actions only make sense once the message is persisted (has a db id) and idle.
const canAct = computed(() => !!props.message.dbId && !props.message.streaming && !streaming.value)

const editing = ref(false)
const draft = ref('')
function startEdit() { draft.value = props.message.content; editing.value = true }
async function saveEdit() {
  const c = draft.value.trim()
  editing.value = false
  if (c && c !== props.message.content) await editMessage(props.message, c)
}
function onDelete() {
  if (confirm('Delete this message?')) deleteMessage(props.message)
}
function onRegen() { regenerate(props.message) }

function imgSrc(url: string) {
  return url.startsWith('/') ? mediaUrl(url) : url
}

function thumb(id: string) {
  return mediaUrl(`/api/upload/${id}?thumb=1`)
}
</script>

<template>
  <div class="flex" :class="isUser ? 'justify-end' : 'justify-start'">
    <div
      class="group relative max-w-[85%] rounded-card border px-3 py-2"
      :class="[
        isUser ? 'border-accent/40 bg-accent/10' : 'border-border bg-panel',
        message.error ? 'border-red' : '',
      ]"
    >
      <div class="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
        <span>{{ message.role }}</span>
        <span v-if="message.model" class="normal-case">· {{ message.model }}</span>
        <!-- Per-message actions (visible on hover) -->
        <span v-if="canAct && !editing" class="ml-auto hidden gap-1 group-hover:flex">
          <button class="text-muted hover:text-fg" title="Edit" @click="startEdit">✎</button>
          <button v-if="!isUser" class="text-muted hover:text-fg" title="Regenerate" @click="onRegen">↻</button>
          <button class="text-muted hover:text-red" title="Delete" @click="onDelete">🗑</button>
        </span>
      </div>

      <!-- Attachments -->
      <div v-if="message.attachments?.length" class="mb-2 flex flex-wrap gap-1.5">
        <template v-for="a in message.attachments" :key="a.id">
          <img v-if="a.mime?.startsWith('image/')" :src="thumb(a.id)" :alt="a.name" :title="a.name" class="h-16 w-16 rounded border border-border object-cover" />
          <span v-else class="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-fg" :title="a.name">📎 {{ a.name }}</span>
        </template>
      </div>

      <!-- Research progress -->
      <div v-if="message.research" class="mb-2 rounded-md border border-border bg-panel2 p-2 text-xs">
        <div class="flex flex-wrap items-center gap-1.5 text-muted">
          <span class="text-accent">Research</span>
          <span v-if="message.research.phase">· {{ message.research.phase }}</span>
          <span v-if="message.research.round">· round {{ message.research.round }}</span>
          <span v-if="message.research.total_sources">· {{ message.research.total_sources }} sources</span>
          <span v-if="message.research.done" class="text-green">· done</span>
        </div>
        <ul v-if="message.research.findings?.length" class="mt-1 list-disc pl-4">
          <li v-for="(f, i) in message.research.findings" :key="i" class="font-medium text-fg/90">{{ f.heading }}</li>
        </ul>
        <div v-if="message.research.sources?.length" class="mt-1 flex flex-col gap-0.5">
          <a v-for="(s, i) in message.research.sources" :key="i" :href="s.url" target="_blank" rel="noopener" class="truncate text-accent hover:underline">{{ s.title || s.url }}</a>
        </div>
      </div>

      <!-- Agent tool events -->
      <div v-if="message.tools?.length" class="mb-2 flex flex-col gap-1.5">
        <details v-for="(t, i) in message.tools" :key="i" class="rounded-md border border-border bg-panel2 px-2 py-1 text-xs">
          <summary class="cursor-pointer text-muted">
            <span class="text-accent">{{ t.tool }}</span>
            <span v-if="t.command" class="ml-1 text-fg/80">{{ t.command }}</span>
            <span v-if="t.exit_code != null" :class="t.exit_code === 0 ? 'text-green' : 'text-red'"> · exit {{ t.exit_code }}</span>
          </summary>
          <pre v-if="t.output" class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-fg/80">{{ t.output }}</pre>
          <img v-if="t.image_url" :src="imgSrc(t.image_url)" class="mt-1 max-h-64 rounded" />
        </details>
      </div>

      <!-- Inline edit -->
      <div v-if="editing" class="flex flex-col gap-2">
        <textarea
          v-model="draft"
          rows="3"
          class="w-full resize-y rounded-md border border-accent bg-panel2 px-2 py-1.5 text-sm text-fg outline-none"
          @keydown.esc="editing = false"
        />
        <div class="flex justify-end gap-2">
          <button class="rounded-md border border-border px-2.5 py-1 text-xs text-fg" @click="editing = false">Cancel</button>
          <button class="rounded-md border border-accent bg-accent px-3 py-1 text-xs text-white" @click="saveEdit">Save</button>
        </div>
      </div>

      <!-- Rendered markdown -->
      <div v-else class="md text-sm leading-relaxed text-fg" v-html="html" />

      <span v-if="message.streaming" class="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />

      <!-- Streamed document -->
      <details v-if="message.doc" class="mt-2 rounded-md border border-border bg-panel2 text-xs" open>
        <summary class="cursor-pointer px-2 py-1 text-muted">
          📄 <span class="text-fg">{{ message.doc.title || 'Document' }}</span>
          <span v-if="message.doc.language"> · {{ message.doc.language }}</span>
          <span v-if="message.doc.saved" class="text-green"> · saved</span>
        </summary>
        <pre class="max-h-72 overflow-auto whitespace-pre-wrap break-words px-2 py-1 text-[12.5px]">{{ message.doc.content }}</pre>
      </details>

      <!-- Sources -->
      <details v-if="message.sources?.length" class="mt-2 rounded-md border border-border bg-panel2 text-xs">
        <summary class="cursor-pointer px-2 py-1 text-muted">Sources ({{ message.sources.length }})</summary>
        <ul class="px-2 py-1">
          <li v-for="(s, i) in message.sources" :key="i" class="truncate">
            <a :href="s.url" target="_blank" rel="noopener" class="text-accent hover:underline">{{ s.title || s.url }}</a>
          </li>
        </ul>
      </details>

      <!-- Memories used -->
      <details v-if="message.memories?.length" class="mt-2 rounded-md border border-border bg-panel2 text-xs">
        <summary class="cursor-pointer px-2 py-1 text-muted">Memories ({{ message.memories.length }})</summary>
        <ul class="list-disc px-2 py-1 pl-5">
          <li v-for="(m, i) in message.memories" :key="i"><span class="text-muted">[{{ m.category }}]</span> {{ m.text }}</li>
        </ul>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Light typography for rendered markdown (Tailwind utilities don't reach v-html). */
.md :deep(p) { margin: 0.35rem 0; }
.md :deep(pre) {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.6rem 0.7rem;
  overflow: auto;
  font-size: 12.5px;
}
.md :deep(code) { font-family: 'FiraCode', ui-monospace, monospace; }
.md :deep(:not(pre) > code) {
  background: var(--color-panel2);
  border-radius: 4px;
  padding: 0.05rem 0.3rem;
}
.md :deep(a) { color: var(--color-accent); text-decoration: underline; }
.md :deep(ul), .md :deep(ol) { margin: 0.35rem 0; padding-left: 1.2rem; }
.md :deep(h1), .md :deep(h2), .md :deep(h3) { margin: 0.6rem 0 0.3rem; font-weight: 600; }
.md :deep(blockquote) { border-left: 3px solid var(--color-border); margin: 0.4rem 0; padding-left: 0.7rem; color: var(--color-muted); }
.md :deep(table) { border-collapse: collapse; margin: 0.4rem 0; }
.md :deep(th), .md :deep(td) { border: 1px solid var(--color-border); padding: 0.25rem 0.5rem; }
</style>
