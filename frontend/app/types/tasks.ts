// TypeScript types mirroring the FastAPI Pydantic models in
// routes/task_routes.py. Keep these in sync with the backend contract.

export type TaskType = 'llm' | 'research' | 'action'
export type Schedule = 'once' | 'daily' | 'weekly' | 'monthly' | 'cron'
export type TriggerType = 'schedule' | 'event' | 'webhook'
export type TaskStatus = 'active' | 'paused' | 'completed'
export type RunStatus = 'running' | 'success' | 'error'

/** Full task as returned by GET /api/tasks and GET /api/tasks/{id}. */
export interface Task {
  id: string
  owner: string | null
  name: string
  prompt: string
  task_type: TaskType
  action: string | null
  schedule: Schedule
  scheduled_time: string | null // "HH:MM" UTC
  scheduled_day: number | null // 0-6 (weekly) or 1-31 (monthly)
  scheduled_date: string | null // ISO 8601
  cron_expression: string | null
  trigger_type: TriggerType
  trigger_event: string | null
  trigger_count: number | null
  trigger_counter: number
  next_run: string | null // ISO 8601
  last_run: string | null // ISO 8601
  status: TaskStatus
  output_target: string
  session_id: string | null
  crew_member_id: string | null
  model: string | null
  endpoint_url: string | null
  run_count: number
  then_task_id: string | null
  notifications_enabled: boolean | null
  webhook_token: string | null
  created_at: string
  updated_at: string
  is_builtin: boolean
  is_modified: boolean
  // Only present when listing with include_last_run=true:
  last_run_status?: RunStatus
  last_run_result?: string
}

/** Payload for POST /api/tasks. */
export interface TaskCreate {
  name?: string
  prompt: string
  task_type?: TaskType
  action?: string | null
  schedule?: Schedule
  scheduled_time?: string | null
  scheduled_day?: number | null
  scheduled_date?: string | null
  cron_expression?: string | null
  trigger_type?: TriggerType
  trigger_event?: string | null
  trigger_count?: number | null
  output_target?: string
  model?: string | null
  endpoint_url?: string | null
  then_task_id?: string | null
  notifications_enabled?: boolean | null
}

/** Payload for PUT /api/tasks/{id} — all fields optional (partial update). */
export type TaskUpdate = Partial<TaskCreate>

/** A single execution record from GET /api/tasks/{id}/runs. */
export interface TaskRun {
  id: string
  task_id: string
  started_at: string
  finished_at: string | null
  status: RunStatus
  result: string | null
  error: string | null
  tokens_used: number | null
  model: string | null
}
