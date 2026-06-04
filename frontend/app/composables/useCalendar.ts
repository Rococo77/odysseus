import type {
  CalendarEvent, Calendar, EventCreate, EventUpdate, EventsResponse, CalendarsResponse,
} from '~/types/calendar'

// Reactive store + typed client for /api/calendar. Month-range event fetch
// (the backend expands recurring occurrences) plus calendar list and event
// CRUD. CalDAV sync, import/export and LLM quick-parse stay in the legacy app.
export function useCalendar() {
  const { request } = useApi()

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

  return {
    events, calendars, activeCalendar, loading, error,
    fetchCalendars, fetchEvents, createEvent, updateEvent, deleteEvent,
  }
}
