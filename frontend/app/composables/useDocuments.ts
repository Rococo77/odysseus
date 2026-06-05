import type { DocumentFull, LibraryDocsResponse } from '~/types/documents'

// Typed client for /api/document(s): a library list plus per-document CRUD,
// metadata patch and archive (routes/document_routes.py).
export function useDocuments() {
  const { request } = useApi()

  function fetchLibrary(opts: { search?: string; language?: string; sort?: string; offset?: number; limit?: number; archived?: boolean } = {}) {
    const p = new URLSearchParams()
    if (opts.search) p.set('search', opts.search)
    if (opts.language) p.set('language', opts.language)
    p.set('sort', opts.sort ?? 'recent')
    p.set('offset', String(opts.offset ?? 0))
    p.set('limit', String(opts.limit ?? 20))
    if (opts.archived) p.set('archived', 'true')
    return request<LibraryDocsResponse>(`/api/documents/library?${p.toString()}`)
  }

  function getDocument(id: string) {
    return request<DocumentFull>(`/api/document/${id}`)
  }

  function createDocument(body: { title: string; content: string; language?: string | null; session_id?: string | null }) {
    return request<DocumentFull>('/api/document', { method: 'POST', body })
  }

  function saveContent(id: string, content: string, summary = 'Manual edit') {
    return request<DocumentFull>(`/api/document/${id}`, { method: 'PUT', body: { content, summary } })
  }

  function patchMeta(id: string, meta: { title?: string; language?: string | null; session_id?: string | null }) {
    return request<DocumentFull>(`/api/document/${id}`, { method: 'PATCH', body: meta })
  }

  function deleteDocument(id: string) {
    return request<{ status: string; id: string }>(`/api/document/${id}`, { method: 'DELETE' })
  }

  function archiveDocument(id: string, archived: boolean) {
    return request<{ ok: boolean; id: string; archived: boolean }>(`/api/document/${id}/archive?archived=${archived}`, { method: 'POST' })
  }

  return { fetchLibrary, getDocument, createDocument, saveContent, patchMeta, deleteDocument, archiveDocument }
}
