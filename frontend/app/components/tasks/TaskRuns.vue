<script setup lang="ts">
import type { Task, TaskRun } from '~/types/tasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ close: [] }>()

const { fetchRuns, regenerateWebhook } = useTasks()
const { mediaUrl } = useApi()

const runs = ref<TaskRun[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)

const webhookUrl = computed(() =>
  props.task.webhook_token ? mediaUrl(`/api/tasks/${props.task.id}/webhook/${props.task.webhook_token}`) : '',
)

onMounted(async () => {
  loading.value = true
  try { runs.value = await fetchRuns(props.task.id, 20) }
  catch (e) { error.value = e instanceof Error ? e.message : 'Failed to load runs' }
  finally { loading.value = false }
})

async function onRegenerate() {
  busy.value = true
  try { await regenerateWebhook(props.task.id) }
  catch (e) { error.value = e instanceof Error ? e.message : 'Regenerate failed' }
  finally { busy.value = false }
}

function copyUrl() {
  if (webhookUrl.value) navigator.clipboard?.writeText(webhookUrl.value)
}

function statusClass(s: string) {
  if (s === 'success') return 'text-green'
  if (s === 'error') return 'text-red'
  return 'text-amber'
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="emit('close')">
    <div class="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-border bg-panel">
      <header class="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div class="truncate font-semibold">{{ task.name || '(untitled)' }}</div>
        <button class="text-sm text-muted hover:text-fg" @click="emit('close')">✕</button>
      </header>

      <div class="overflow-auto p-4">
        <!-- Webhook -->
        <div v-if="task.trigger_type === 'webhook'" class="mb-4 rounded-md border border-border bg-panel2 p-3">
          <div class="mb-1 text-xs uppercase tracking-wide text-muted">Webhook URL</div>
          <div v-if="webhookUrl" class="flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate text-xs text-fg">{{ webhookUrl }}</code>
            <button class="rounded-md border border-border px-2 py-0.5 text-xs text-fg hover:border-accent" @click="copyUrl">Copy</button>
            <button class="rounded-md border border-border px-2 py-0.5 text-xs text-fg hover:border-accent disabled:opacity-50" :disabled="busy" @click="onRegenerate">Regenerate</button>
          </div>
          <p v-else class="text-xs text-muted">No token yet — POST to the endpoint to trigger.</p>
        </div>

        <!-- Run history -->
        <div class="mb-2 text-xs uppercase tracking-wide text-muted">Recent runs</div>
        <p v-if="error" class="text-sm text-red">{{ error }}</p>
        <p v-else-if="loading" class="py-4 text-center text-muted">Loading…</p>
        <p v-else-if="!runs.length" class="py-4 text-center text-muted">No runs yet.</p>
        <ul v-else class="flex flex-col gap-2">
          <li v-for="r in runs" :key="r.id" class="rounded-md border border-border bg-panel2 p-2 text-sm">
            <div class="flex items-center gap-2 text-xs">
              <span :class="statusClass(r.status)" class="font-medium uppercase">{{ r.status }}</span>
              <span class="text-muted">{{ formatDateTime(r.started_at) }}</span>
              <span v-if="r.tokens_used" class="ml-auto text-muted">{{ r.tokens_used }} tok</span>
            </div>
            <pre v-if="r.result || r.error" class="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[12px] text-fg/80">{{ r.error || r.result }}</pre>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
