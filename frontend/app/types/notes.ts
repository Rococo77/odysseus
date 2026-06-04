// TypeScript types mirroring the /api/notes contract (routes/note_routes.py).

export type NoteType = 'note' | 'checklist'
export type NoteRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface NoteItem {
  text: string
  done: boolean
}

/** Full note as returned by GET /api/notes and the CRUD endpoints. */
export interface Note {
  id: string
  owner: string | null
  title: string
  content: string | null
  items: NoteItem[] | null
  note_type: NoteType
  color: string | null
  label: string | null
  pinned: boolean
  archived: boolean
  due_date: string | null
  source: string
  session_id: string | null
  sort_order: number
  image_url: string | null
  repeat: NoteRepeat
  ai_classification: unknown | null
  ai_content_hash: string | null
  agent_session_id: string | null
  created_at: string | null
  updated_at: string | null
}

/** Payload for POST /api/notes. */
export interface NoteCreate {
  title?: string
  content?: string | null
  items?: NoteItem[] | null
  note_type?: NoteType
  color?: string | null
  label?: string | null
  pinned?: boolean
  due_date?: string | null
  repeat?: NoteRepeat
  sort_order?: number
}

/** Payload for PUT /api/notes/{id} — all optional (partial update). */
export type NoteUpdate = Partial<NoteCreate> & { archived?: boolean }

export interface NoteListResponse {
  notes: Note[]
}
