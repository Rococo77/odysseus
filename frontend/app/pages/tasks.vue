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
  <section class="tasks">
    <div class="head">
      <h1>Tasks</h1>
      <div class="head-actions">
        <button class="ghost" :disabled="loading" @click="fetchTasks">↻ Refresh</button>
        <button class="primary" @click="openCreate">+ New task</button>
      </div>
    </div>

    <Transition name="fade">
      <p v-if="notice" class="notice">{{ notice }}</p>
    </Transition>

    <Transition name="fade">
      <div v-if="showForm" class="form-wrap">
        <TasksTaskForm :task="editing" :saving="saving" @submit="onSubmit" @cancel="closeForm" />
      </div>
    </Transition>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading && !tasks.length" class="state">Loading…</p>
    <p v-else-if="!tasks.length" class="state">No tasks yet. Create your first one.</p>

    <div v-else class="list">
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
.tasks { max-width: 820px; margin: 0 auto; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
h1 { margin: 0; font-size: 1.4rem; }
.head-actions { display: flex; gap: 0.5rem; }
.head-actions button { border-radius: 6px; padding: 0.4rem 0.8rem; border: 1px solid var(--border); }
.ghost { background: transparent; color: var(--fg); }
.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.form-wrap { margin-bottom: 1rem; }
.list { display: flex; flex-direction: column; gap: 0.6rem; }
.state, .error { color: var(--muted); padding: 2rem 0; text-align: center; }
.error { color: var(--red); }
.notice {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.7rem;
  margin: 0 0 0.8rem;
  font-size: 13px;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
