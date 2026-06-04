<script setup lang="ts">
import type { ChatMessage } from '~/types/sessions'

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
</script>

<template>
  <aside class="drawer">
    <header class="head">
      <div class="title" :title="title">{{ title || '(untitled)' }}</div>
      <button class="close" title="Close" @click="emit('close')">✕</button>
    </header>

    <p v-if="loading" class="state">Loading history…</p>
    <p v-else-if="error" class="state error">{{ error }}</p>
    <p v-else-if="!messages.length" class="state">No messages.</p>

    <div v-else class="messages">
      <div v-for="(m, i) in messages" :key="m.metadata?._db_id || i" class="msg" :class="m.role">
        <span class="role">{{ m.role }}</span>
        <pre class="content">{{ preview(m.content) }}</pre>
      </div>
    </div>
    <p class="hint">Read-only preview. Open in the chat view to continue the conversation.</p>
  </aside>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--border);
}
.title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close { background: none; border: none; color: var(--muted); font-size: 14px; }
.close:hover { color: var(--fg); }
.messages { flex: 1; overflow: auto; padding: 0.8rem; display: flex; flex-direction: column; gap: 0.6rem; }
.msg { border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.6rem; background: var(--panel-2); }
.msg.user { border-left: 3px solid var(--accent); }
.msg.assistant { border-left: 3px solid var(--green); }
.msg.system { border-left: 3px solid var(--muted); opacity: 0.85; }
.role { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.content { margin: 0.3rem 0 0; white-space: pre-wrap; word-break: break-word; font-family: var(--font); font-size: 13px; }
.state { color: var(--muted); padding: 1.5rem; text-align: center; }
.state.error { color: var(--red); }
.hint { margin: 0; padding: 0.5rem 0.8rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }
</style>
