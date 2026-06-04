import type { Task } from '~/types/tasks'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Human-readable schedule/trigger label for a task (mirrors legacy _scheduleLabel). */
export function scheduleLabel(task: Task): string {
  if (task.trigger_type === 'webhook') return 'On webhook'
  if (task.trigger_type === 'event') {
    const ev = task.trigger_event || 'event'
    return task.trigger_count && task.trigger_count > 1
      ? `Every ${task.trigger_count} × ${ev}`
      : `On ${ev}`
  }

  const time = task.scheduled_time || ''
  switch (task.schedule) {
    case 'once':
      return task.scheduled_date
        ? `Once · ${formatDateTime(task.scheduled_date)}`
        : 'Once'
    case 'daily':
      return time ? `Daily at ${time}` : 'Daily'
    case 'weekly': {
      const day = task.scheduled_day != null ? DAYS[task.scheduled_day] ?? '' : ''
      return `Weekly${day ? ` on ${day}` : ''}${time ? ` at ${time}` : ''}`
    }
    case 'monthly':
      return `Monthly${task.scheduled_day != null ? ` on day ${task.scheduled_day}` : ''}${time ? ` at ${time}` : ''}`
    case 'cron':
      return task.cron_expression ? `Cron: ${task.cron_expression}` : 'Cron'
    default:
      return task.schedule
  }
}

/** Compact local date-time for ISO 8601 strings; returns '—' when empty. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
