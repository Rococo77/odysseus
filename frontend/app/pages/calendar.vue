<script setup lang="ts">
import type { CalendarEvent } from '~/types/calendar'

// Sixth migrated page (Tailwind). Month grid with event CRUD via a modal and a
// per-calendar filter. The backend expands recurring occurrences for the
// visible range. CalDAV sync, import/export and LLM quick-parse stay legacy.
const {
  events, calendars, activeCalendar, loading, error,
  fetchCalendars, fetchEvents,
} = useCalendar()

const cursor = ref(new Date())
const viewYear = computed(() => cursor.value.getFullYear())
const viewMonth = computed(() => cursor.value.getMonth())

const grid = computed(() => buildMonthGrid(viewYear.value, viewMonth.value))
const byDay = computed(() => eventsByDay(events.value))

const modalOpen = ref(false)
const editing = ref<CalendarEvent | null>(null)
const newDate = ref<string | undefined>(undefined)

async function reload() {
  const { start, end } = monthRange(viewYear.value, viewMonth.value)
  await fetchEvents(start, end)
}

onMounted(async () => {
  await fetchCalendars()
  await reload()
})
watch([viewYear, viewMonth, activeCalendar], reload)

function prevMonth() { cursor.value = new Date(viewYear.value, viewMonth.value - 1, 1) }
function nextMonth() { cursor.value = new Date(viewYear.value, viewMonth.value + 1, 1) }
function today() { cursor.value = new Date() }

function openCreate(dayKey: string) {
  editing.value = null
  newDate.value = dayKey
  modalOpen.value = true
}
function openEdit(ev: CalendarEvent) {
  editing.value = ev
  newDate.value = undefined
  modalOpen.value = true
}
function closeModal() { modalOpen.value = false; editing.value = null }
async function onSaved() { closeModal(); await reload() }
</script>

<template>
  <section class="mx-auto max-w-5xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-semibold">{{ MONTHS[viewMonth] }} {{ viewYear }}</h1>
        <span v-if="loading" class="text-xs text-muted">loading…</span>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="activeCalendar" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
          <option value="">All calendars</option>
          <option v-for="c in calendars" :key="c.href" :value="c.href">{{ c.name }}</option>
        </select>
        <div class="flex rounded-md border border-border">
          <button class="px-2.5 py-1.5 text-sm text-fg hover:bg-panel2" @click="prevMonth">‹</button>
          <button class="border-x border-border px-2.5 py-1.5 text-sm text-fg hover:bg-panel2" @click="today">Today</button>
          <button class="px-2.5 py-1.5 text-sm text-fg hover:bg-panel2" @click="nextMonth">›</button>
        </div>
      </div>
    </div>

    <p v-if="error" class="mb-3 text-sm text-red">{{ error }}</p>

    <!-- Weekday header -->
    <div class="grid grid-cols-7 gap-px text-center text-xs text-muted">
      <div v-for="d in WEEKDAYS" :key="d" class="py-1">{{ d }}</div>
    </div>

    <!-- Day grid -->
    <div class="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-border bg-border">
      <div
        v-for="cell in grid"
        :key="cell.key"
        class="min-h-24 cursor-pointer bg-panel p-1 transition-colors hover:bg-panel2"
        :class="cell.inMonth ? '' : 'opacity-45'"
        @click="openCreate(cell.key)"
      >
        <div class="mb-1 flex justify-end">
          <span
            class="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
            :class="cell.isToday ? 'bg-accent font-semibold text-white' : 'text-muted'"
          >{{ cell.date.getDate() }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <button
            v-for="ev in (byDay.get(cell.key) || [])"
            :key="ev.uid"
            class="truncate rounded px-1 py-0.5 text-left text-[11px] text-white"
            :style="{ backgroundColor: ev.color || 'var(--color-accent)' }"
            :title="ev.summary"
            @click.stop="openEdit(ev)"
          >
            <span v-if="eventTime(ev)" class="opacity-80">{{ eventTime(ev) }} </span>{{ ev.summary || '(untitled)' }}
          </button>
        </div>
      </div>
    </div>

    <CalendarEventModal
      v-if="modalOpen"
      :event="editing"
      :default-date="newDate"
      :calendars="calendars"
      @saved="onSaved"
      @deleted="onSaved"
      @close="closeModal"
    />
  </section>
</template>
