import type { CalendarEvent } from '~/types/calendar'

export interface GridCell {
  date: Date
  key: string // YYYY-MM-DD (local)
  inMonth: boolean
  isToday: boolean
}

/** Local YYYY-MM-DD key for a Date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local date key for an ISO string (date or datetime). */
export function isoDateKey(iso: string): string {
  // All-day events come as plain YYYY-MM-DD; keep as-is to avoid TZ shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : dateKey(d)
}

const MS_DAY = 86_400_000

/** Build a 6-week (42-cell) Monday-start grid for the given month. */
export function buildMonthGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Monday = 0
  const start = new Date(year, month, 1 - offset)
  const todayKey = dateKey(new Date())
  const cells: GridCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getTime() + i * MS_DAY)
    cells.push({
      date,
      key: dateKey(date),
      inMonth: date.getMonth() === month,
      isToday: dateKey(date) === todayKey,
    })
  }
  return cells
}

/** ISO range [gridStart, gridEnd) covering the month's full 6-week grid. */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const cells = buildMonthGrid(year, month)
  const start = cells[0]!.date
  const end = new Date(cells[41]!.date.getTime() + MS_DAY)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Group events by local day key. */
export function eventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const key = isoDateKey(e.dtstart)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Short local time label for a timed event (empty for all-day). */
export function eventTime(e: CalendarEvent): string {
  if (e.all_day) return ''
  const d = new Date(e.dtstart)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
