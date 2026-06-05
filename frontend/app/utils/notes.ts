import type { Note } from '~/types/notes'

/** Preset note colors (hex). null = default panel color. */
export const NOTE_COLORS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Default' },
  { value: '#3b3320', label: 'Amber' },
  { value: '#1f3326', label: 'Green' },
  { value: '#1f2b3a', label: 'Blue' },
  { value: '#33232b', label: 'Rose' },
  { value: '#2c2438', label: 'Purple' },
]

/** Checklist completion as {done, total}; total 0 for plain notes. */
export function checklistProgress(note: Note): { done: number; total: number } {
  if (note.note_type !== 'checklist' || !note.items) return { done: 0, total: 0 }
  return {
    done: note.items.filter(i => i.done).length,
    total: note.items.length,
  }
}
