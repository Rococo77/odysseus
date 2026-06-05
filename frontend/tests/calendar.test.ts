import { describe, it, expect } from 'vitest'
import { buildMonthGrid, dateKey, isoDateKey, eventsByDay } from '~/utils/calendar'
import type { CalendarEvent } from '~/types/calendar'

describe('buildMonthGrid', () => {
  it('produces a 42-cell Monday-start grid', () => {
    const grid = buildMonthGrid(2024, 0) // January 2024 (Jan 1 is a Monday)
    expect(grid).toHaveLength(42)
    expect(grid[0]!.key).toBe('2024-01-01')
    expect(grid[0]!.date.getDay()).toBe(1) // Monday
    expect(grid.filter(c => c.inMonth)).toHaveLength(31)
  })

  it('starts the grid before the 1st when the month starts mid-week', () => {
    const grid = buildMonthGrid(2024, 1) // Feb 2024 starts on Thursday
    expect(grid[0]!.inMonth).toBe(false)
    expect(grid.find(c => c.key === '2024-02-01')!.inMonth).toBe(true)
  })
})

describe('dateKey / isoDateKey', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    expect(dateKey(new Date(2024, 2, 5))).toBe('2024-03-05')
  })
  it('passes through all-day date strings (no TZ shift)', () => {
    expect(isoDateKey('2024-07-09')).toBe('2024-07-09')
  })
  it('derives a local key from a datetime (TZ-agnostic check)', () => {
    const iso = '2024-07-09T12:00:00Z'
    expect(isoDateKey(iso)).toBe(dateKey(new Date(iso)))
  })
})

describe('eventsByDay', () => {
  it('groups events under their start-day key', () => {
    const events = [
      { uid: '1', dtstart: '2024-07-09', all_day: true } as CalendarEvent,
      { uid: '2', dtstart: '2024-07-09', all_day: true } as CalendarEvent,
      { uid: '3', dtstart: '2024-07-10', all_day: true } as CalendarEvent,
    ]
    const map = eventsByDay(events)
    expect(map.get('2024-07-09')).toHaveLength(2)
    expect(map.get('2024-07-10')).toHaveLength(1)
  })
})
