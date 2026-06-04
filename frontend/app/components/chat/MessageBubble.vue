<script setup lang="ts">
import type { DisplayMessage } from '~/types/chat'

const props = defineProps<{ message: DisplayMessage }>()
const { mediaUrl } = useApi()

const html = computed(() => renderMarkdown(props.message.content))
const isUser = computed(() => props.message.role === 'user')

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
      class="max-w-[85%] rounded-card border px-3 py-2"
      :class="[
        isUser ? 'border-accent/40 bg-accent/10' : 'border-border bg-panel',
        message.error ? 'border-red' : '',
      ]"
    >
      <div class="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
        <span>{{ message.role }}</span>
        <span v-if="message.model" class="normal-case">· {{ message.model }}</span>
      </div>

      <!-- Attachments -->
      <div v-if="message.attachments?.length" class="mb-2 flex flex-wrap gap-1.5">
        <template v-for="a in message.attachments" :key="a.id">
          <img v-if="a.mime?.startsWith('image/')" :src="thumb(a.id)" :alt="a.name" :title="a.name" class="h-16 w-16 rounded border border-border object-cover" />
          <span v-else class="rounded-md border border-border bg-panel2 px-2 py-1 text-xs text-fg" :title="a.name">📎 {{ a.name }}</span>
        </template>
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

      <!-- Rendered markdown -->
      <div class="md text-sm leading-relaxed text-fg" v-html="html" />

      <span v-if="message.streaming" class="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />
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
