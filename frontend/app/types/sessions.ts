// TypeScript types mirroring the FastAPI session contract in
// routes/session_routes.py. Keep in sync with the backend.

export type SessionMode = 'chat' | 'agent' | 'research' | null

/** Active session as returned by GET /api/sessions. */
export interface Session {
  id: string
  name: string
  model: string
  endpoint_url: string
  rag: boolean
  archived: boolean
  folder: string | null
  total_tokens: number
  is_important: boolean
  created_at: string | null
  updated_at: string | null
  last_message_at: string | null
  has_documents: boolean
  has_images: boolean
  mode: SessionMode
  message_count: number
}

/** Lighter shape returned by GET /api/sessions/archived. */
export interface ArchivedSession {
  id: string
  name: string
  model: string
  message_count: number
  created_at: string | null
  updated_at: string | null
  is_important: boolean
}

export interface ArchivedResponse {
  sessions: ArchivedSession[]
  total: number
}

export type MessageRole = 'user' | 'assistant' | 'system'

/** A single message from GET /api/history/{session_id}. */
export interface ChatMessage {
  role: MessageRole
  content: string
  metadata?: {
    timestamp?: string
    _db_id?: string
    [key: string]: unknown
  }
}
