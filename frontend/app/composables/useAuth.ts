import type { AuthStatus, LoginPayload, LoginResult } from '~/types/auth'

// Auth state + client for /api/auth/*. status is cached app-wide; the global
// `auth` middleware uses fetchStatus to gate routes.
export function useAuth() {
  const { request } = useApi()
  const status = useState<AuthStatus | null>('auth-status', () => null)

  async function fetchStatus(force = false): Promise<AuthStatus> {
    if (status.value && !force) return status.value
    status.value = await request<AuthStatus>('/api/auth/status')
    return status.value
  }

  async function login(payload: LoginPayload): Promise<LoginResult> {
    const res = await request<LoginResult>('/api/auth/login', { method: 'POST', body: payload })
    if (res.ok) await fetchStatus(true)
    return res
  }

  async function logout() {
    try { await request('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    status.value = null
    await navigateTo('/login')
  }

  function setup(username: string, password: string) {
    return request<{ ok: boolean }>('/api/auth/setup', { method: 'POST', body: { username, password } })
  }

  function signup(username: string, password: string) {
    return request<{ ok: boolean }>('/api/auth/signup', { method: 'POST', body: { username, password } })
  }

  const isAdmin = computed(() => !!status.value?.is_admin)
  const username = computed(() => status.value?.username ?? null)
  const authenticated = computed(() => !!status.value?.authenticated)

  return { status, fetchStatus, login, logout, setup, signup, isAdmin, username, authenticated }
}
