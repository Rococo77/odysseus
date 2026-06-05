<script setup lang="ts">
import type { SendOptions, Attachment, Preset } from '~/types/chat'

const props = defineProps<{ streaming?: boolean; disabled?: boolean; presets?: Preset[] }>()
const emit = defineEmits<{ send: [text: string, opts: SendOptions]; stop: [] }>()

const { uploadFiles } = useChat()

const text = ref('')
const presetId = ref('')
const pending = ref<Attachment[]>([])
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const opts = reactive<Omit<SendOptions, 'presetId' | 'attachments'>>({ agent: false, web: false, research: false, bash: false })

const toggles: Array<{ key: keyof typeof opts; label: string }> = [
  { key: 'agent', label: 'Agent' },
  { key: 'web', label: 'Web' },
  { key: 'research', label: 'Research' },
  { key: 'bash', label: 'Bash' },
]

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  uploading.value = true
  try {
    const uploaded = await uploadFiles(input.files)
    pending.value.push(...uploaded)
  } catch { /* surfaced by the thread on send if needed */ }
  finally {
    uploading.value = false
    input.value = ''
  }
}

function removePending(id: string) {
  pending.value = pending.value.filter(a => a.id !== id)
}

function submit() {
  const body = text.value.trim()
  if (!body || props.disabled || props.streaming) return
  emit('send', body, { ...opts, presetId: presetId.value || undefined, attachments: pending.value.slice() })
  text.value = ''
  pending.value = []
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="border-t border-border bg-panel p-2.5">
    <div class="mb-2 flex flex-wrap items-center gap-1.5">
      <button
        v-for="t in toggles"
        :key="t.key"
        class="rounded-full border px-2.5 py-0.5 text-xs"
        :class="opts[t.key] ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'"
        @click="opts[t.key] = !opts[t.key]"
      >{{ t.label }}</button>

      <select
        v-if="presets?.length"
        v-model="presetId"
        class="ml-auto rounded-full border border-border bg-panel2 px-2.5 py-0.5 text-xs text-fg outline-none focus:border-accent"
        title="Character preset"
      >
        <option value="">No preset</option>
        <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>

    <!-- Pending attachments -->
    <div v-if="pending.length || uploading" class="mb-2 flex flex-wrap gap-1.5">
      <span v-for="a in pending" :key="a.id" class="flex items-center gap-1 rounded-md border border-border bg-panel2 px-2 py-0.5 text-xs text-fg">
        <span class="max-w-40 truncate">{{ a.mime?.startsWith('image/') ? '🖼' : '📎' }} {{ a.name }}</span>
        <button class="text-muted hover:text-red" @click="removePending(a.id)">✕</button>
      </span>
      <span v-if="uploading" class="rounded-md border border-border px-2 py-0.5 text-xs text-muted">Uploading…</span>
    </div>

    <div class="flex items-end gap-2">
      <button
        class="rounded-md border border-border bg-panel2 px-2.5 py-2 text-fg hover:border-accent disabled:opacity-50"
        :disabled="disabled || uploading"
        title="Attach files"
        @click="fileInput?.click()"
      >📎</button>
      <input ref="fileInput" type="file" multiple class="hidden" @change="onFiles" >

      <textarea
        v-model="text"
        rows="1"
        :disabled="disabled"
        placeholder="Message… (Enter to send, Shift+Enter for newline)"
        class="max-h-40 min-h-10 flex-1 resize-y rounded-md border border-border bg-panel2 px-3 py-2 text-sm text-fg outline-none focus:border-accent disabled:opacity-50"
        @keydown="onKeydown"
      />
      <button
        v-if="streaming"
        class="rounded-md border border-red px-4 py-2 text-sm text-red hover:bg-red/10"
        @click="emit('stop')"
      >Stop</button>
      <button
        v-else
        class="rounded-md border border-accent bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
        :disabled="!text.trim() || disabled"
        @click="submit"
      >Send</button>
    </div>
  </div>
</template>
