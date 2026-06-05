// Normalize errors thrown by $fetch (ofetch FetchError) into a clean,
// user-facing message. Pulls the FastAPI error body (detail/message/error,
// incl. 422 validation arrays) and falls back to status / network hints.
export function extractApiError(e: unknown): string {
  const err = e as {
    statusCode?: number
    status?: number
    data?: unknown
    message?: string
    name?: string
  }

  const data = err?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    if (typeof d.message === 'string') return d.message
    if (typeof d.error === 'string') return d.error
    // FastAPI 422 validation: detail is an array of {msg, loc}
    if (Array.isArray(d.detail) && d.detail.length) {
      const first = d.detail[0] as { msg?: string }
      if (first?.msg) return first.msg
    }
  }

  const status = err?.statusCode ?? err?.status
  if (status === 401 || status === 403) return 'Not authorized — please sign in.'
  if (status === 404) return 'Not found.'
  if (status) return `Request failed (${status})`

  // No HTTP response → almost always a connectivity problem.
  if (err?.name === 'FetchError' || /fetch|network|Failed to fetch/i.test(err?.message ?? '')) {
    return 'Network error — is the backend running?'
  }
  return err?.message || 'Request failed'
}
