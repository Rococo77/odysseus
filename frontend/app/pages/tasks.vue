<script setup lang="ts">
import type { Task, TaskCreate } from '~/types/tasks'

// Pilot page: the first feature migrated off the legacy static/js/tasks.js.
// Consumes the unchanged /api/tasks endpoints via the typed composable.
const {
  tasks, loading, error,
  fetchTasks, createTask, updateTask, deleteTask,
  runNow, pauseTask, resumeTask,
} = useTasks()

const showForm = ref(false)
const editing = ref<Task | null>(null)
const saving = ref(false)
const busyId = ref<string | null>(null)
const notice = ref<string | null>(null)

onMounted(fetchTasks)

function openCreate() {
  editing.value = null
  showForm.value = true
}
function openEdit(task: Task) {
  editing.value = task
  showForm.value = true
}
function closeForm() {
  showForm.value = false
  editing.value = null
}

async function onSubmit(payload: TaskCreate) {
  saving.value = true
  try {
    if (editing.value) {
      await updateTask(editing.value.id, payload)
      flash('Task updated')
    } else {
      await createTask(payload)
      flash('Task created')
    }
    closeForm()
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Save failed')
  } finally {
    saving.value = false
  }
}

async function withBusy(id: string, fn: () => Promise<void>, msg: string) {
  busyId.value = id
  try {
    await fn()
    flash(msg)
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Action failed')
  } finally {
    busyId.value = null
  }
}

function onRun(id: string) { return withBusy(id, () => runNow(id), 'Run started') }
function onPause(id: string) { return withBusy(id, () => pauseTask(id), 'Paused') }
function onResume(id: string) { return withBusy(id, () => resumeTask(id), 'Resumed') }
function onRemove(id: string) {
  if (!confirm('Delete this task?')) return
  return withBusy(id, () => deleteTask(id), 'Deleted')
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  notice.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (notice.value = null), 2500)
}
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Tasks</h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:border-accent disabled:opacity-50" :disabled="loading" @click="fetchTasks">↻ Refresh</button>
        <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white" @click="openCreate">+ New task</button>
      </div>
    </div>

    <Transition name="fade">
      <p v-if="notice" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-[13px]">{{ notice }}</p>
    </Transition>

    <Transition name="fade">
      <div v-if="showForm" class="mb-4">
        <TasksTaskForm :task="editing" :saving="saving" @submit="onSubmit" @cancel="closeForm" />
      </div>
    </Transition>

    <p v-if="error" class="py-8 text-center text-red">{{ error }}</p>
    <p v-else-if="loading && !tasks.length" class="py-8 text-center text-muted">Loading…</p>
    <p v-else-if="!tasks.length" class="py-8 text-center text-muted">No tasks yet. Create your first one.</p>

    <div v-else class="flex flex-col gap-2.5">
      <TasksTaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :busy="busyId === task.id"
        @run="onRun"
        @pause="onPause"
        @resume="onResume"
        @edit="openEdit"
        @remove="onRemove"
      />
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
