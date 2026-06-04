<script setup lang="ts">
import type { ChatMessage, MessageRole } from '~/types/sessions'

const props = defineProps<{ sessionId: string; title: string }>()
const emit = defineEmits<{ close: [] }>()

const { fetchHistory } = useSessions()
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

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
    <header class="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
      <div class="truncate font-semibold" :title="title">{{ title || '(untitled)' }}</div>
      <button class="text-sm text-muted hover:text-fg" title="Close" @click="emit('close')">✕</button>
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
