<script setup lang="ts">
import type { Task } from '~/types/tasks'

const props = defineProps<{ task: Task; busy?: boolean }>()
const emit = defineEmits<{
  run: [id: string]
  pause: [id: string]
  resume: [id: string]
  edit: [task: Task]
  remove: [id: string]
}>()

const statusColor = computed(() => {
  if (props.task.status === 'paused') return 'var(--color-amber)'
  if (props.task.status === 'completed') return 'var(--color-muted)'
  return 'var(--color-green)'
})

const runStatusClass = computed(() => {
  switch (props.task.last_run_status) {
    case 'success': return 'border-green text-green'
    case 'error': return 'border-red text-red'
    case 'running': return 'border-amber text-amber'
    default: return 'border-border text-muted'
  }
})
</script>

<template>
  <article
    class="rounded-card border border-border bg-panel px-4 py-3 transition-opacity"
    :class="{ 'opacity-55 pointer-events-none': busy }"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: statusColor }" />
        <span class="truncate font-semibold">{{ task.name || '(untitled)' }}</span>
        <span class="text-[11px] uppercase tracking-wide text-muted">{{ task.task_type }}</span>
        <span v-if="task.is_builtin" class="rounded-full border border-border px-1.5 text-[10px] text-accent">built-in</span>
      </div>
      <div class="flex shrink-0 gap-1">
        <button v-if="task.status !== 'paused'" class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent disabled:opacity-40" :disabled="busy" title="Pause" @click="emit('pause', task.id)">⏸</button>
        <button v-else class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent disabled:opacity-40" :disabled="busy" title="Resume" @click="emit('resume', task.id)">▶</button>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent disabled:opacity-40" :disabled="busy" title="Run now" @click="emit('run', task.id)">⚡</button>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-accent disabled:opacity-40" :disabled="busy" title="Edit" @click="emit('edit', task)">✎</button>
        <button class="rounded-md border border-border bg-panel2 px-1.5 py-0.5 leading-none text-fg hover:border-red disabled:opacity-40" :disabled="busy" title="Delete" @click="emit('remove', task.id)">🗑</button>
      </div>
    </div>

    <p v-if="task.prompt" class="clamp-2 mt-2 text-[13px] text-muted">{{ task.prompt }}</p>

    <div class="mt-2 flex flex-wrap gap-1.5">
      <span class="rounded-full border border-border px-2 py-0.5 text-[11px]">{{ scheduleLabel(task) }}</span>
      <span class="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">next: {{ formatDateTime(task.next_run) }}</span>
      <span class="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">last: {{ formatDateTime(task.last_run) }}</span>
      <span v-if="task.last_run_status" class="rounded-full border px-2 py-0.5 text-[11px]" :class="runStatusClass">{{ task.last_run_status }}</span>
      <span class="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">runs: {{ task.run_count }}</span>
    </div>
  </article>
</template>

<style scoped>
/* Tailwind v4 (this version) doesn't emit line-clamp; one tiny rule for the
   2-line prompt preview. */
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
