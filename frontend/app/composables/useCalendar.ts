import type {
  CalendarEvent, Calendar, EventCreate, EventUpdate, EventsResponse, CalendarsResponse,
} from '~/types/calendar'

// Reactive store + typed client for /api/calendar. Month-range event fetch
// (the backend expands recurring occurrences) plus calendar list and event
// CRUD. CalDAV sync, import/export and LLM quick-parse stay in the legacy app.
export function useCalendar() {
  const { request, mediaUrl } = useApi()

  const events = useState<CalendarEvent[]>('cal-events', () => [])
  const calendars = useState<Calendar[]>('cal-calendars', () => [])
  const activeCalendar = useState<string>('cal-active', () => '')
  const loading = useState<boolean>('cal-loading', () => false)
  const error = useState<string | null>('cal-error', () => null)

  async function fetchCalendars() {
    const res = await request<CalendarsResponse>('/api/calendar/calendars')
    calendars.value = res.calendars
  }

  async function fetchEvents(startISO: string, endISO: string) {
    loading.value = true
    error.value = null
    try {
      const p = new URLSearchParams({ start: startISO, end: endISO })
      if (activeCalendar.value) p.set('calendar', activeCalendar.value)
      const res = await request<EventsResponse>(`/api/calendar/events?${p.toString()}`)
      events.value = res.events
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load events'
    } finally {
      loading.value = false
    }
  }

  function createEvent(body: EventCreate) {
    return request<CalendarEvent>('/api/calendar/events', { method: 'POST', body })
  }

  function updateEvent(uid: string, body: EventUpdate) {
    return request<CalendarEvent>(`/api/calendar/events/${encodeURIComponent(uid)}`, { method: 'PUT', body })
  }

  function deleteEvent(uid: string) {
    return request(`/api/calendar/events/${encodeURIComponent(uid)}`, { method: 'DELETE' })
  }

  /** Natural-language → structured event fields (does not create it). */
  function quickParse(text: string) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return request<{ ok: boolean; event?: Partial<EventCreate>; error?: string }>(
      '/api/calendar/quick-parse', { method: 'POST', body: { text, tz } },
    )
  }

  /** Import events from an .ics file into a (new or existing) calendar. */
  function importIcs(file: File, calendarName = '') {
    const fd = new FormData()
    fd.set('file', file, file.name)
    if (calendarName) fd.set('calendar_name', calendarName)
    return request<Record<string, unknown>>('/api/calendar/import', { method: 'POST', body: fd })
  }

  /** Download a calendar as an .ics file. */
  async function exportIcs(calId: string, name = 'calendar') {
    const res = await fetch(mediaUrl(`/api/calendar/export/${calId}`), { credentials: 'include' })
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // --- CalDAV integration ---
  function saveCaldav(cfg: { url: string; username?: string; password?: string }) {
    return request<{ ok: boolean; cleared?: boolean }>('/api/calendar/config', { method: 'POST', body: cfg })
  }
  function testCaldav(cfg: { url?: string; username?: string; password?: string } = {}) {
    return request<{ ok: boolean; error?: string }>('/api/calendar/test', { method: 'POST', body: cfg })
  }
  function syncCaldav() {
    return request<Record<string, unknown>>('/api/calendar/sync', { method: 'POST' })
  }

  return {
    events, calendars, activeCalendar, loading, error,
    fetchCalendars, fetchEvents, createEvent, updateEvent, deleteEvent,
    quickParse, importIcs, exportIcs,
    saveCaldav, testCaldav, syncCaldav,
  }
}
