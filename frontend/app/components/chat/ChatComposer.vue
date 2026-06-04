<script setup lang="ts">
import type { SendOptions } from '~/types/chat'

const props = defineProps<{ streaming?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ send: [text: string, opts: SendOptions]; stop: [] }>()

const text = ref('')
const opts = reactive<SendOptions>({ agent: false, web: false, research: false, bash: false })

const toggles: Array<{ key: keyof SendOptions; label: string }> = [
  { key: 'agent', label: 'Agent' },
  { key: 'web', label: 'Web' },
  { key: 'research', label: 'Research' },
  { key: 'bash', label: 'Bash' },
]

function submit() {
  const body = text.value.trim()
  if (!body || props.disabled || props.streaming) return
  emit('send', body, { ...opts })
  text.value = ''
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
    <div class="mb-2 flex flex-wrap gap-1.5">
      <button
        v-for="t in toggles"
        :key="t.key"
        class="rounded-full border px-2.5 py-0.5 text-xs"
        :class="opts[t.key] ? 'border-accent text-accent' : 'border-border text-muted hover:text-fg'"
        @click="opts[t.key] = !opts[t.key]"
      >{{ t.label }}</button>
    </div>

    <div class="flex items-end gap-2">
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
