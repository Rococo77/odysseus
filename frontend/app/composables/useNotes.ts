import type { Note, NoteCreate, NoteUpdate, NoteItem, NoteListResponse } from '~/types/notes'

// Reactive store + typed client for /api/notes. Mirrors the active-notes CRUD
// in the legacy static/js/notes.js (reminders/drag-reorder left to the legacy
// app for now). All bodies are JSON (FastAPI Pydantic models).
export function useNotes() {
  const { request } = useApi()

  const notes = useState<Note[]>('notes', () => [])
  const loading = useState<boolean>('notes-loading', () => false)
  const error = useState<string | null>('notes-error', () => null)
  const showArchived = useState<boolean>('notes-archived', () => false)

  async function fetchNotes() {
    loading.value = true
    error.value = null
    try {
      const res = await request<NoteListResponse>(`/api/notes?archived=${showArchived.value}`)
      notes.value = res.notes ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load notes'
    } finally {
      loading.value = false
    }
  }

  async function createNote(payload: NoteCreate): Promise<Note> {
    const note = await request<Note>('/api/notes', { method: 'POST', body: payload })
    await fetchNotes()
    return note
  }

  async function updateNote(id: string, payload: NoteUpdate): Promise<Note> {
    const note = await request<Note>(`/api/notes/${id}`, { method: 'PUT', body: payload })
    const i = notes.value.findIndex(n => n.id === id)
    if (i !== -1) notes.value[i] = note
    return note
  }

  async function deleteNote(id: string) {
    await request(`/api/notes/${id}`, { method: 'DELETE' })
    notes.value = notes.value.filter(n => n.id !== id)
  }

  async function togglePin(id: string) {
    const res = await request<{ pinned: boolean }>(`/api/notes/${id}/pin`, { method: 'POST' })
    const n = notes.value.find(n => n.id === id)
    if (n) n.pinned = res.pinned
  }

  async function toggleArchive(id: string) {
    await request(`/api/notes/${id}/archive`, { method: 'POST' })
    // Archived state now differs from the current view filter → drop from list.
    notes.value = notes.value.filter(n => n.id !== id)
  }

  async function toggleItem(id: string, index: number) {
    const res = await request<{ items: NoteItem[] }>(`/api/notes/${id}/items/${index}/toggle`, { method: 'POST' })
    const n = notes.value.find(n => n.id === id)
    if (n) n.items = res.items
  }

  return {
    notes,
    loading,
    error,
    showArchived,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    toggleArchive,
    toggleItem,
  }
}
