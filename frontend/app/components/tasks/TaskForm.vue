<script setup lang="ts">
import type { Task, TaskCreate, Schedule, TaskType } from '~/types/tasks'

const props = defineProps<{ task?: Task | null; saving?: boolean }>()
const emit = defineEmits<{
  submit: [payload: TaskCreate]
  cancel: []
}>()

// Seed the form from an existing task (edit) or sensible defaults (create).
const form = reactive<TaskCreate>({
  name: props.task?.name ?? '',
  prompt: props.task?.prompt ?? '',
  task_type: props.task?.task_type ?? 'llm',
  schedule: props.task?.schedule ?? 'daily',
  scheduled_time: props.task?.scheduled_time ?? '09:00',
  scheduled_day: props.task?.scheduled_day ?? null,
  cron_expression: props.task?.cron_expression ?? null,
  notifications_enabled: props.task?.notifications_enabled ?? true,
})

const taskTypes: TaskType[] = ['llm', 'research', 'action']
const schedules: Schedule[] = ['once', 'daily', 'weekly', 'monthly', 'cron']
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Shared field styling.
const field = 'rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm text-fg outline-none focus:border-accent'
const labelCls = 'flex flex-col gap-1 text-xs text-muted'

const canSubmit = computed(() => form.prompt.trim().length > 0)

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit', { ...form })
}
</script>

<template>
  <form class="flex flex-col gap-3 rounded-card border border-border bg-panel p-4" @submit.prevent="onSubmit">
    <h3 class="font-semibold">{{ props.task ? 'Edit task' : 'New task' }}</h3>

    <label :class="labelCls">
      <span>Name <em class="opacity-70">(optional)</em></span>
      <input v-model="form.name" type="text" placeholder="Auto-generated if empty" :class="field" >
    </label>

    <label :class="labelCls">
      <span>Prompt / instruction</span>
      <textarea v-model="form.prompt" rows="3" placeholder="What should this task do?" required :class="[field, 'resize-y']" />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label :class="labelCls">
        <span>Type</span>
        <select v-model="form.task_type" :class="field">
          <option v-for="t in taskTypes" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>

      <label :class="labelCls">
        <span>Schedule</span>
        <select v-model="form.schedule" :class="field">
          <option v-for="s in schedules" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label v-if="form.schedule !== 'cron'" :class="labelCls">
        <span>Time (UTC)</span>
        <input v-model="form.scheduled_time" type="time" :class="field" >
      </label>

      <label v-if="form.schedule === 'weekly'" :class="labelCls">
        <span>Day of week</span>
        <select v-model.number="form.scheduled_day" :class="field">
          <option v-for="(d, i) in weekdays" :key="d" :value="i">{{ d }}</option>
        </select>
      </label>

      <label v-if="form.schedule === 'monthly'" :class="labelCls">
        <span>Day of month</span>
        <input v-model.number="form.scheduled_day" type="number" min="1" max="31" :class="field" >
      </label>

      <label v-if="form.schedule === 'cron'" :class="[labelCls, 'col-span-2']">
        <span>Cron expression</span>
        <input v-model="form.cron_expression" type="text" placeholder="*/5 * * * *" :class="field" >
      </label>
    </div>

    <label class="flex items-center gap-2 text-xs text-muted">
      <input v-model="form.notifications_enabled" type="checkbox" class="accent-accent" >
      <span>Notify on completion</span>
    </label>

    <div class="mt-1 flex justify-end gap-2">
      <button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm text-fg" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="rounded-md border border-accent bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50" :disabled="!canSubmit || saving">
        {{ saving ? 'Saving…' : props.task ? 'Save' : 'Create' }}
      </button>
    </div>
  </form>
</template>
