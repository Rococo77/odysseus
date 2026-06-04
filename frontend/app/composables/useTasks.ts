import type { Task, TaskCreate, TaskUpdate, TaskRun } from '~/types/tasks'

// Reactive store + typed client for the /api/tasks endpoints. Mirrors the
// operations the legacy static/js/tasks.js performs, so the page can be
// swapped behind the strangler facade without backend changes.
export function useTasks() {
  const { request } = useApi()

  const tasks = useState<Task[]>('tasks', () => [])
  const loading = useState<boolean>('tasks-loading', () => false)
  const error = useState<string | null>('tasks-error', () => null)

  async function fetchTasks() {
    loading.value = true
    error.value = null
    try {
      tasks.value = await request<Task[]>('/api/tasks?include_last_run=true')
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load tasks'
    } finally {
      loading.value = false
    }
  }

  async function createTask(payload: TaskCreate): Promise<Task> {
    const task = await request<Task>('/api/tasks', { method: 'POST', body: payload })
    await fetchTasks()
    return task
  }

  async function updateTask(id: string, payload: TaskUpdate): Promise<Task> {
    const task = await request<Task>(`/api/tasks/${id}`, { method: 'PUT', body: payload })
    await fetchTasks()
    return task
  }

  async function deleteTask(id: string): Promise<void> {
    await request(`/api/tasks/${id}`, { method: 'DELETE' })
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  async function runNow(id: string, force = false): Promise<void> {
    await request(`/api/tasks/${id}/run${force ? '?force=true' : ''}`, { method: 'POST' })
  }

  async function pauseTask(id: string): Promise<void> {
    await request(`/api/tasks/${id}/pause`, { method: 'POST' })
    await fetchTasks()
  }

  async function resumeTask(id: string): Promise<void> {
    await request(`/api/tasks/${id}/resume`, { method: 'POST' })
    await fetchTasks()
  }

  function fetchRuns(id: string, limit = 10): Promise<TaskRun[]> {
    return request<TaskRun[]>(`/api/tasks/${id}/runs?limit=${limit}`)
  }

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    runNow,
    pauseTask,
    resumeTask,
    fetchRuns,
  }
}
