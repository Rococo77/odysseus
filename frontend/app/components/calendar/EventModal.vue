<script setup lang="ts">
import type { CalendarEvent, Calendar, EventCreate, EventUpdate } from '~/types/calendar'

const props = defineProps<{
  event?: CalendarEvent | null
  defaultDate?: string // YYYY-MM-DD for a new event
  calendars: Calendar[]
}>()
const emit = defineEmits<{ saved: []; deleted: []; close: [] }>()

const { createEvent, updateEvent, deleteEvent } = useCalendar()

const isEdit = computed(() => !!props.event)
const busy = ref(false)
const errorMsg = ref<string | null>(null)

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Seed form state from the event (edit) or the clicked day (create).
const base = props.defaultDate ? new Date(`${props.defaultDate}T09:00`) : new Date()
const summary = ref(props.event?.summary ?? '')
const allDay = ref(props.event?.all_day ?? false)
const description = ref(props.event?.description ?? '')
const location = ref(props.event?.location ?? '')
const rrule = ref(props.event?.rrule ?? '')
const calendarHref = ref(props.event?.calendar_href ?? props.calendars[0]?.href ?? '')

// Date/time fields
const dateStart = ref(props.event ? props.event.dtstart.slice(0, 10) : (props.defaultDate ?? toLocalInput(base).slice(0, 10)))
const dateEnd = ref(props.event ? props.event.dtend.slice(0, 10) : dateStart.value)
const timeStart = ref(props.event && !props.event.all_day ? toLocalInput(new Date(props.event.dtstart)) : toLocalInput(base))
const timeEnd = ref(props.event && !props.event.all_day ? toLocalInput(new Date(props.event.dtend)) : toLocalInput(new Date(base.getTime() + 3600_000)))

const canSave = computed(() => summary.value.trim().length > 0)

function buildPayload(): EventCreate {
  const payload: EventCreate = {
    summary: summary.value.trim(),
    all_day: allDay.value,
    description: description.value,
    location: location.value,
    rrule: rrule.value || null,
    dtstart: allDay.value ? dateStart.value : timeStart.value,
    dtend: allDay.value ? (dateEnd.value || dateStart.value) : timeEnd.value,
  }
  return payload
}

async function save() {
  if (!canSave.value) return
  busy.value = true
  errorMsg.value = null
  try {
    if (isEdit.value && props.event) {
      // EventUpdate intentionally omits calendar_href (no calendar move here).
      const body: EventUpdate = buildPayload()
      await updateEvent(props.event.uid, body)
    } else {
      await createEvent({ ...buildPayload(), calendar_href: calendarHref.value || null })
    }
    emit('saved')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!props.event || !confirm('Delete this event?')) return
  busy.value = true
  try {
    await deleteEvent(props.event.uid)
    emit('deleted')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-card border border-border bg-panel p-4" :class="{ 'opacity-60 pointer-events-none': busy }">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">{{ isEdit ? 'Edit event' : 'New event' }}</h3>
        <button class="text-muted hover:text-fg" @click="emit('close')">✕</button>
      </div>

      <input v-model="summary" placeholder="Title" class="mb-2 w-full rounded-md border border-border bg-panel2 px-2.5 py-2 text-sm font-medium text-fg outline-none focus:border-accent" />

      <label class="mb-2 flex items-center gap-2 text-sm text-muted">
        <input v-model="allDay" type="checkbox" class="accent-accent" /> All day
      </label>

      <div class="mb-2 grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1 text-xs text-muted">
          <span>Start</span>
          <input v-if="allDay" v-model="dateStart" type="date" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" />
          <input v-else v-model="timeStart" type="datetime-local" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">
          <span>End</span>
          <input v-if="allDay" v-model="dateEnd" type="date" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" />
          <input v-else v-model="timeEnd" type="datetime-local" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" />
        </label>
      </div>

      <input v-model="location" placeholder="Location (optional)" class="mb-2 w-full rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />
      <textarea v-model="description" rows="2" placeholder="Description (optional)" class="mb-2 w-full resize-y rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent" />

      <div class="mb-3 grid grid-cols-2 gap-2">
        <label v-if="!isEdit && calendars.length" class="flex flex-col gap-1 text-xs text-muted">
          <span>Calendar</span>
          <select v-model="calendarHref" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
            <option v-for="c in calendars" :key="c.href" :value="c.href">{{ c.name }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">
          <span>Repeat (RRULE, optional)</span>
          <input v-model="rrule" placeholder="FREQ=WEEKLY" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent" />
        </label>
      </div>

      <p v-if="errorMsg" class="mb-2 text-sm text-red">{{ errorMsg }}</p>

      <div class="flex items-center justify-between">
        <button v-if="isEdit" class="rounded-md border border-red px-3 py-1.5 text-sm text-red hover:bg-red/10" @click="remove">Delete</button>
        <div class="ml-auto flex gap-2">
          <button class="rounded-md border border-border px-3 py-1.5 text-sm text-fg" @click="emit('close')">Cancel</button>
          <button class="rounded-md border border-accent bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50" :disabled="!canSave || busy" @click="save">
            {{ isEdit ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
