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

  return { request }
}
