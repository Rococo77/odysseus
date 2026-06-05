import { describe, it, expect } from 'vitest'
import { scheduleLabel, formatDateTime } from '~/utils/schedule'
import type { Task } from '~/types/tasks'

const base = {
  trigger_type: 'schedule', schedule: 'daily', scheduled_time: null,
  scheduled_day: null, scheduled_date: null, cron_expression: null,
  trigger_event: null, trigger_count: null,
} as unknown as Task

const t = (over: Partial<Task>): Task => ({ ...base, ...over } as Task)

describe('scheduleLabel', () => {
  it('daily with time', () => {
    expect(scheduleLabel(t({ schedule: 'daily', scheduled_time: '09:00' }))).toBe('Daily at 09:00')
  })
  it('weekly with day + time', () => {
    expect(scheduleLabel(t({ schedule: 'weekly', scheduled_day: 0, scheduled_time: '08:30' })))
      .toBe('Weekly on Mon at 08:30')
  })
  it('cron', () => {
    expect(scheduleLabel(t({ schedule: 'cron', cron_expression: '*/5 * * * *' }))).toBe('Cron: */5 * * * *')
  })
  it('webhook trigger', () => {
    expect(scheduleLabel(t({ trigger_type: 'webhook' }))).toBe('On webhook')
  })
  it('event trigger with count', () => {
    expect(scheduleLabel(t({ trigger_type: 'event', trigger_event: 'session_created', trigger_count: 3 })))
      .toBe('Every 3 × session_created')
  })
})

describe('formatDateTime', () => {
  it('returns a dash for empty', () => {
    expect(formatDateTime(null)).toBe('—')
  })
  it('returns the raw string when unparseable', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
