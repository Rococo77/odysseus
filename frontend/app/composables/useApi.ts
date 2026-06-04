// Thin typed wrapper around $fetch that prefixes every call with the
// configured API base (relative '' for web, absolute for the desktop build)
// and sends credentials so the FastAPI session cookie is included.
export function useApi() {
  const { public: { apiBase } } = useRuntimeConfig()

  function request<T>(path: string, opts: Parameters<typeof $fetch<T>>[1] = {}): Promise<T> {
    return $fetch<T>(`${apiBase}${path}`, {
      credentials: 'include',
      ...opts,
    })
  }

  // Absolute URL for media/static resources (e.g. <img src>). Same-origin on
  // web (apiBase ''); absolute against the backend in the desktop build.
  function mediaUrl(path: string): string {
    return `${apiBase}${path}`
  }

  return { request, mediaUrl }
}
