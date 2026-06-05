<script setup lang="ts">
import type { SendOptions } from '~/types/chat'

// Final migrated page (Tailwind). Streaming chat over POST /api/chat_stream
// with a session sidebar, markdown rendering and agent tool display.
const { messages, sessionId, streaming, error, metrics, presets, loadHistory, newSession, send, stop, fetchPresets } = useChat()
const { sessions, fetchSessions } = useSessions()

const loadingHistory = ref(false)
const threadEl = ref<HTMLElement | null>(null)

onMounted(() => { fetchSessions(); fetchPresets() })

async function open(id: string) {
  if (id === sessionId.value) return
  loadingHistory.value = true
  try { await loadHistory(id) } finally { loadingHistory.value = false }
  scrollToBottom()
}

async function startNew() {
  await newSession()
  await fetchSessions()
}

function onSend(text: string, opts: SendOptions) {
  send(text, opts)
}

function scrollToBottom() {
  nextTick(() => {
    const el = threadEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// Keep pinned to the bottom as messages grow / stream.
watch(() => messages.value.map(m => m.content.length).join(','), scrollToBottom, { flush: 'post' })
</script>

<template>
  <section class="flex h-[calc(100vh-110px)] gap-3">
    <!-- Sidebar -->
    <aside class="flex w-60 shrink-0 flex-col rounded-card border border-border bg-panel">
      <div class="border-b border-border p-2">
        <button class="w-full rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white" @click="startNew">+ New chat</button>
      </div>
      <div class="flex-1 overflow-auto p-1.5">
        <button
          v-for="s in sessions"
          :key="s.id"
          class="mb-1 block w-full truncate rounded-md px-2 py-1.5 text-left text-sm"
          :class="s.id === sessionId ? 'bg-panel2 text-fg' : 'text-muted hover:bg-panel2 hover:text-fg'"
          :title="s.name"
          @click="open(s.id)"
        >{{ s.name || '(untitled)' }}</button>
      </div>
    </aside>

    <!-- Thread -->
    <div class="flex min-w-0 flex-1 flex-col rounded-card border border-border bg-bg">
      <div v-if="!sessionId" class="flex flex-1 items-center justify-center text-muted">
        Select a chat or start a new one.
      </div>

      <template v-else>
        <div ref="threadEl" class="flex-1 space-y-3 overflow-auto p-4">
          <p v-if="loadingHistory" class="text-center text-muted">Loading…</p>
          <p v-else-if="!messages.length" class="text-center text-muted">No messages yet. Say hello 👋</p>
          <ChatMessageBubble v-for="(m, i) in messages" :key="m.dbId || i" :message="m" />
        </div>

        <p v-if="error" class="px-4 py-1 text-sm text-red">{{ error }}</p>
        <p v-if="metrics" class="px-4 py-1 text-[11px] text-muted">
          {{ metrics.input_tokens ?? '?' }}→{{ metrics.output_tokens ?? '?' }} tok
          <span v-if="metrics.tokens_per_second"> · {{ metrics.tokens_per_second.toFixed(1) }} tok/s</span>
          <span v-if="metrics.response_time"> · {{ metrics.response_time.toFixed(1) }}s</span>
        </p>

        <ChatChatComposer :streaming="streaming" :presets="presets" @send="onSend" @stop="stop" />
      </template>
    </div>
  </section>
</template>
