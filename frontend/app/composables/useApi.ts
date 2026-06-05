// Thin typed wrapper around $fetch that prefixes every call with the
// configured API base (relative '' for web, absolute for the desktop build)
// and sends credentials so the FastAPI session cookie is included.
export function useApi() {
  const { public: { apiBase } } = useRuntimeConfig()

  async function request<T>(path: string, opts: Parameters<typeof $fetch<T>>[1] = {}): Promise<T> {
    try {
      return await $fetch<T>(`${apiBase}${path}`, {
        credentials: 'include',
        ...opts,
      })
    } catch (e) {
      // Surface a clean, user-facing message everywhere (see utils/apiError).
      throw new Error(extractApiError(e))
    }
  }

  // Absolute URL for media/static resources (e.g. <img src>). Same-origin on
  // web (apiBase ''); absolute against the backend in the desktop build.
  function mediaUrl(path: string): string {
    return `${apiBase}${path}`
  }

  return { request, mediaUrl }
}
