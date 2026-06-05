<script setup lang="ts">
import type { CalendarEvent } from '~/types/calendar'

// Month / week / day views with event CRUD via a modal, per-calendar filter,
// natural-language quick-add and .ics import/export. The backend expands
// recurring occurrences for the visible range. CalDAV sync stays legacy.
const {
  events, calendars, activeCalendar, loading, error,
  fetchCalendars, fetchEvents, createEvent, quickParse, importIcs, exportIcs, syncCaldav,
} = useCalendar()

const cursor = ref(new Date())
const quickText = ref('')
const quickBusy = ref(false)
const banner = ref<string | null>(null)
const icsInput = ref<HTMLInputElement | null>(null)

function notify(msg: string) {
  banner.value = msg
  setTimeout(() => (banner.value = null), 3000)
}

async function onQuickAdd() {
  const text = quickText.value.trim()
  if (!text) return
  quickBusy.value = true
  try {
    const res = await quickParse(text)
    if (!res.ok || !res.event) { notify(res.error || 'Could not parse'); return }
    await createEvent({ ...res.event, calendar_href: activeCalendar.value || calendars.value[0]?.href || null } as Parameters<typeof createEvent>[0])
    quickText.value = ''
    await reload()
    notify('Event added')
  } catch (e) { notify(e instanceof Error ? e.message : 'Quick add failed') }
  finally { quickBusy.value = false }
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try { await importIcs(file); await fetchCalendars(); await reload(); notify('Imported') }
  catch (err) { notify(err instanceof Error ? err.message : 'Import failed') }
}

async function onExport() {
  const cal = calendars.value.find(c => c.href === activeCalendar.value) || calendars.value[0]
  if (!cal) { notify('No calendar to export'); return }
  try { await exportIcs(cal.href, cal.name) } catch (e) { notify(e instanceof Error ? e.message : 'Export failed') }
}

async function onSync() {
  try { await syncCaldav(); await fetchCalendars(); await reload(); notify('Synced from CalDAV') }
  catch (e) { notify(e instanceof Error ? e.message : 'Sync failed (configure CalDAV in Settings)') }
}
const viewMode = ref<'month' | 'week' | 'day'>('month')
const viewYear = computed(() => cursor.value.getFullYear())
const viewMonth = computed(() => cursor.value.getMonth())

const monthCells = computed(() => buildMonthGrid(viewYear.value, viewMonth.value))
const weekCells = computed(() => buildWeekGrid(cursor.value))
const dayCell = computed(() => buildWeekGrid(cursor.value).find(c => c.key === dateKey(cursor.value))!)
const byDay = computed(() => eventsByDay(events.value))

const headerLabel = computed(() => {
  if (viewMode.value === 'month') return `${MONTHS[viewMonth.value]} ${viewYear.value}`
  if (viewMode.value === 'day') return cursor.value.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const w = weekCells.value
  return `${w[0]!.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${w[6]!.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
})

const modalOpen = ref(false)
const editing = ref<CalendarEvent | null>(null)
const newDate = ref<string | undefined>(undefined)

function currentRange() {
  if (viewMode.value === 'month') return monthRange(viewYear.value, viewMonth.value)
  if (viewMode.value === 'week') return weekRange(cursor.value)
  return dayRange(cursor.value)
}
async function reload() {
  const { start, end } = currentRange()
  await fetchEvents(start, end)
}

onMounted(async () => {
  await fetchCalendars()
  await reload()
})
watch([cursor, viewMode, activeCalendar], reload)

const STEP_DAYS = { week: 7, day: 1 } as const
function shift(dir: number) {
  if (viewMode.value === 'month') { cursor.value = new Date(viewYear.value, viewMonth.value + dir, 1); return }
  const days = STEP_DAYS[viewMode.value]
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), cursor.value.getDate() + dir * days)
}
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
        <h1 class="text-2xl font-semibold">{{ headerLabel }}</h1>
        <span v-if="loading" class="text-xs text-muted">loading…</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-md border border-border text-sm">
          <button v-for="m in (['month','week','day'] as const)" :key="m" class="px-2.5 py-1.5 capitalize" :class="viewMode === m ? 'bg-panel2 text-fg' : 'text-muted'" @click="viewMode = m">{{ m }}</button>
        </div>
        <select v-model="activeCalendar" class="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent">
          <option value="">All calendars</option>
          <option v-for="c in calendars" :key="c.href" :value="c.href">{{ c.name }}</option>
        </select>
        <div class="flex rounded-md border border-border">
          <button class="px-2.5 py-1.5 text-sm text-fg hover:bg-panel2" @click="shift(-1)">‹</button>
          <button class="border-x border-border px-2.5 py-1.5 text-sm text-fg hover:bg-panel2" @click="today">Today</button>
          <button class="px-2.5 py-1.5 text-sm text-fg hover:bg-panel2" @click="shift(1)">›</button>
        </div>
      </div>
    </div>

    <!-- Quick-add + ICS import/export -->
    <div class="mb-3 flex flex-wrap items-center gap-2" :class="{ 'opacity-60 pointer-events-none': quickBusy }">
      <input
        v-model="quickText"
        type="text"
        placeholder="Add via text — e.g. “lunch with Sara friday 1pm downtown”"
        class="min-w-56 flex-1 rounded-md border border-border bg-panel2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent"
        @keydown.enter.prevent="onQuickAdd"
      >
      <button class="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="!quickText.trim()" @click="onQuickAdd">Quick add</button>
      <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="icsInput?.click()">Import .ics</button>
      <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="onExport">Export .ics</button>
      <button class="rounded-md border border-border px-2.5 py-1.5 text-sm text-fg hover:border-accent" @click="onSync">Sync</button>
      <input ref="icsInput" type="file" accept=".ics" class="hidden" @change="onImport" >
    </div>

    <Transition name="fade">
      <p v-if="banner" class="mb-3 rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm">{{ banner }}</p>
    </Transition>

    <p v-if="error" class="mb-3 text-sm text-red">{{ error }}</p>

    <!-- MONTH VIEW -->
    <template v-if="viewMode === 'month'">
      <div class="grid grid-cols-7 gap-px text-center text-xs text-muted">
        <div v-for="d in WEEKDAYS" :key="d" class="py-1">{{ d }}</div>
      </div>
      <div class="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-border bg-border">
        <div
          v-for="cell in monthCells"
          :key="cell.key"
          class="min-h-24 cursor-pointer bg-panel p-1 transition-colors hover:bg-panel2"
          :class="cell.inMonth ? '' : 'opacity-45'"
          @click="openCreate(cell.key)"
        >
          <div class="mb-1 flex justify-end">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs" :class="cell.isToday ? 'bg-accent font-semibold text-white' : 'text-muted'">{{ cell.date.getDate() }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <button v-for="ev in dayEvents(byDay, cell.key)" :key="ev.uid" class="truncate rounded px-1 py-0.5 text-left text-[11px] text-white" :style="{ backgroundColor: ev.color || 'var(--color-accent)' }" :title="ev.summary" @click.stop="openEdit(ev)">
              <span v-if="eventTime(ev)" class="opacity-80">{{ eventTime(ev) }} </span>{{ ev.summary || '(untitled)' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- WEEK VIEW -->
    <div v-else-if="viewMode === 'week'" class="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-border bg-border">
      <div v-for="cell in weekCells" :key="cell.key" class="flex min-h-[60vh] cursor-pointer flex-col bg-panel p-1.5 transition-colors hover:bg-panel2" @click="openCreate(cell.key)">
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-xs text-muted">{{ dayHeader(cell.date) }}</span>
          <span v-if="cell.isToday" class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{{ cell.date.getDate() }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <button v-for="ev in dayEvents(byDay, cell.key)" :key="ev.uid" class="truncate rounded px-1 py-0.5 text-left text-[11px] text-white" :style="{ backgroundColor: ev.color || 'var(--color-accent)' }" :title="ev.summary" @click.stop="openEdit(ev)">
            <span v-if="eventTime(ev)" class="opacity-80">{{ eventTime(ev) }} </span>{{ ev.summary || '(untitled)' }}
          </button>
        </div>
      </div>
    </div>

    <!-- DAY VIEW -->
    <div v-else class="cursor-pointer rounded-card border border-border bg-panel p-3" @click="openCreate(dayCell.key)">
      <div class="flex flex-col gap-1">
        <button v-for="ev in dayEvents(byDay, dayCell.key)" :key="ev.uid" class="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-white" :style="{ backgroundColor: ev.color || 'var(--color-accent)' }" :title="ev.summary" @click.stop="openEdit(ev)">
          <span class="w-14 shrink-0 text-xs opacity-80">{{ ev.all_day ? 'All day' : eventTime(ev) }}</span>
          <span class="truncate">{{ ev.summary || '(untitled)' }}</span>
          <span v-if="ev.location" class="ml-auto truncate text-xs opacity-80">{{ ev.location }}</span>
        </button>
        <p v-if="!dayEvents(byDay, dayCell.key).length" class="py-8 text-center text-sm text-muted">No events. Click to add.</p>
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

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
