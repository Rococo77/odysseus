import type { Session, ChatMessage, ArchivedResponse } from '~/types/sessions'

// Reactive store + typed client for the /api/session(s) endpoints. Mirrors the
// operations in the legacy static/js/sessions.js for the active session list.
// Note: several backend endpoints expect form-encoded bodies (FastAPI Form),
// so we send URLSearchParams rather than JSON for those.
export function useSessions() {
  const { request, mediaUrl } = useApi()

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
    // useApi already normalizes the 403 SESSION_STARRED body into the message.
    await request(`/api/session/${id}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.id !== id)
  }

  async function fetchHistory(id: string): Promise<ChatMessage[]> {
    const res = await request<{ history: ChatMessage[] }>(`/api/history/${id}`)
    return res.history ?? []
  }

  // --- Archived view (paginated server-side search) ---
  function fetchArchived(opts: { search?: string; offset?: number; limit?: number; sort?: string; model?: string } = {}) {
    const p = new URLSearchParams()
    if (opts.search) p.set('search', opts.search)
    p.set('offset', String(opts.offset ?? 0))
    p.set('limit', String(opts.limit ?? 20))
    p.set('sort', opts.sort ?? 'recent')
    if (opts.model) p.set('model', opts.model)
    return request<ArchivedResponse>(`/api/sessions/archived?${p.toString()}`)
  }

  function unarchiveSession(id: string) {
    return request(`/api/session/${id}/unarchive`, { method: 'POST' })
  }

  // --- Bulk operations ---
  async function bulkDelete(ids: string[]): Promise<number> {
    const res = await request<{ deleted: number }>('/api/sessions/bulk-delete', { method: 'POST', body: { ids } })
    sessions.value = sessions.value.filter(s => !ids.includes(s.id))
    return res.deleted ?? 0
  }

  async function bulkArchive(ids: string[]) {
    for (const id of ids) await request(`/api/session/${id}/archive`, { method: 'POST' })
    sessions.value = sessions.value.filter(s => !ids.includes(s.id))
  }

  /** Compact a session's history (summarize old messages). */
  function compactSession(id: string) {
    return request<{ ok: boolean; summarized: number; kept: number; message_count: number }>(
      `/api/session/${id}/compact`, { method: 'POST' },
    )
  }

  /** Auto-sort unfiled sessions into folders (optionally cleanup-only). */
  function autoSort(skipLlm = false) {
    return request<Record<string, unknown>>(`/api/sessions/auto-sort?skip_llm=${skipLlm}`, { method: 'POST' })
  }

  /** Trigger a browser download of a session export (md/txt/json/html). */
  async function exportSession(id: string, fmt: 'md' | 'txt' | 'json' | 'html' = 'md') {
    const res = await fetch(mediaUrl(`/api/session/${id}/export?fmt=${fmt}`), { credentials: 'include' })
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-${id}.${fmt}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
    fetchArchived,
    unarchiveSession,
    bulkDelete,
    bulkArchive,
    compactSession,
    autoSort,
    exportSession,
  }
}
