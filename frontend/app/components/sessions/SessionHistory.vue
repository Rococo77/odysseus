<script setup lang="ts">
import type { ChatMessage, MessageRole } from '~/types/sessions'

const props = defineProps<{ sessionId: string; title: string }>()
const emit = defineEmits<{ close: [] }>()

const { fetchHistory, exportSession, compactSession } = useSessions()
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)

async function onExport(fmt: 'md' | 'txt' | 'json' | 'html') {
  busy.value = true
  try { await exportSession(props.sessionId, fmt) }
  catch (e) { error.value = e instanceof Error ? e.message : 'Export failed' }
  finally { busy.value = false }
}

async function onCompact() {
  if (!confirm('Summarize older messages to shorten this conversation?')) return
  busy.value = true
  try { await compactSession(props.sessionId); await load() }
  catch (e) { error.value = e instanceof Error ? e.message : 'Compact failed' }
  finally { busy.value = false }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    messages.value = await fetchHistory(props.sessionId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load history'
  } finally {
    loading.value = false
  }
}

// Reload whenever the selected session changes.
watch(() => props.sessionId, load, { immediate: true })

function preview(content: string): string {
  // Some assistant messages persist stringified JSON; show it as plain text.
  return content.length > 4000 ? content.slice(0, 4000) + '…' : content
}

function roleBorder(role: MessageRole): string {
  if (role === 'user') return 'border-l-accent'
  if (role === 'assistant') return 'border-l-green'
  return 'border-l-muted opacity-85'
}
</script>

<template>
  <aside class="flex h-full flex-col overflow-hidden rounded-card border border-border bg-panel">
    <header class="flex items-center gap-2 border-b border-border px-3 py-2.5">
      <div class="min-w-0 flex-1 truncate font-semibold" :title="title">{{ title || '(untitled)' }}</div>
      <div class="flex shrink-0 items-center gap-1" :class="{ 'opacity-50 pointer-events-none': busy }">
        <select
          class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 text-xs text-fg outline-none focus:border-accent"
          title="Export"
          @change="onExport(($event.target as HTMLSelectElement).value as 'md'|'txt'|'json'|'html'); ($event.target as HTMLSelectElement).value = ''"
        >
          <option value="">Export…</option>
          <option value="md">Markdown</option>
          <option value="txt">Text</option>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
        </select>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 text-xs text-fg hover:border-accent" title="Compact history" @click="onCompact">Compact</button>
        <button class="text-sm text-muted hover:text-fg" title="Close" @click="emit('close')">✕</button>
      </div>
    </header>

    <p v-if="loading" class="p-6 text-center text-muted">Loading history…</p>
    <p v-else-if="error" class="p-6 text-center text-red">{{ error }}</p>
    <p v-else-if="!messages.length" class="p-6 text-center text-muted">No messages.</p>

    <div v-else class="flex flex-1 flex-col gap-2.5 overflow-auto p-3">
      <div
        v-for="(m, i) in messages"
        :key="m.metadata?._db_id || i"
        class="rounded-lg border border-l-[3px] border-border bg-panel2 px-2.5 py-2"
        :class="roleBorder(m.role)"
      >
        <span class="text-[10px] uppercase tracking-wide text-muted">{{ m.role }}</span>
        <pre class="mt-1 whitespace-pre-wrap break-words font-sans text-[13px]">{{ preview(m.content) }}</pre>
      </div>
    </div>
    <p class="border-t border-border px-3 py-2 text-[11px] text-muted">Read-only preview. Open in the chat view to continue the conversation.</p>
  </aside>
</template>
