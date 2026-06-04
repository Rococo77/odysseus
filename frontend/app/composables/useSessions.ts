import type { Session, ChatMessage } from '~/types/sessions'

// Reactive store + typed client for the /api/session(s) endpoints. Mirrors the
// operations in the legacy static/js/sessions.js for the active session list.
// Note: several backend endpoints expect form-encoded bodies (FastAPI Form),
// so we send URLSearchParams rather than JSON for those.
export function useSessions() {
  const { request } = useApi()

  const sessions = useState<Session[]>('sessions', () => [])
  const loading = useState<boolean>('sessions-loading', () => false)
  const error = useState<string | null>('sessions-error', () => null)

  async function fetchSessions() {
    loading.value = true
    error.value = null
    try {
      sessions.value = await request<Session[]>('/api/sessions')
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load sessions'
    } finally {
      loading.value = false
    }
  }

  function patch(id: string, fields: Record<string, string>) {
    const body = new URLSearchParams(fields)
    return request<Partial<Session>>(`/api/session/${id}`, { method: 'PATCH', body })
  }

  async function renameSession(id: string, name: string) {
    await patch(id, { name })
    const s = sessions.value.find(s => s.id === id)
    if (s) s.name = name
  }

  async function moveToFolder(id: string, folder: string) {
    await patch(id, { folder })
    const s = sessions.value.find(s => s.id === id)
    if (s) s.folder = folder || null
  }

  async function toggleImportant(id: string) {
    const s = sessions.value.find(s => s.id === id)
    const next = !(s?.is_important)
    await request(`/api/session/${id}/important`, {
      method: 'POST',
      body: new URLSearchParams({ important: String(next) }),
    })
    if (s) s.is_important = next
  }

  async function archiveSession(id: string) {
    await request(`/api/session/${id}/archive`, { method: 'POST' })
    sessions.value = sessions.value.filter(s => s.id !== id)
  }

  async function deleteSession(id: string) {
    try {
      await request(`/api/session/${id}`, { method: 'DELETE' })
      sessions.value = sessions.value.filter(s => s.id !== id)
    } catch (e: unknown) {
      // Backend returns 403 {error:"SESSION_STARRED", message:"..."} for starred.
      const data = (e as { data?: { message?: string; error?: string } })?.data
      throw new Error(data?.message || data?.error || 'Delete failed')
    }
  }

  async function fetchHistory(id: string): Promise<ChatMessage[]> {
    const res = await request<{ history: ChatMessage[] }>(`/api/history/${id}`)
    return res.history ?? []
  }

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    renameSession,
    moveToFolder,
    toggleImportant,
    archiveSession,
    deleteSession,
    fetchHistory,
  }
}
