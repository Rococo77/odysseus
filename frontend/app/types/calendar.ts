// TypeScript types for the /api/calendar contract (routes/calendar_routes.py).
// The events endpoint returns recurring occurrences already expanded server-side.

export interface CalendarEvent {
  uid: string
  summary: string
  dtstart: string // ISO 8601 (date for all_day, datetime±Z otherwise)
  dtend: string
  all_day: boolean
  is_utc: boolean
  description: string
  location: string
  rrule: string
  calendar: string // calendar name
  calendar_href: string // calendar id
  color: string
  event_type: string | null
  importance: string
}

export interface Calendar {
  name: string
  href: string // calendar id
  color: string
}

/** POST /api/calendar/events body. */
export interface EventCreate {
  summary: string
  dtstart: string
  dtend?: string | null
  all_day?: boolean
  description?: string
  location?: string
  calendar_href?: string | null
  rrule?: string | null
  color?: string | null
}

/** PUT /api/calendar/events/{uid} body (calendar move not supported here). */
export type EventUpdate = Partial<Omit<EventCreate, 'calendar_href'>>

export interface EventsResponse { events: CalendarEvent[] }
export interface CalendarsResponse { calendars: Calendar[] }
