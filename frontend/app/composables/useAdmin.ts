export interface AdminUser {
  username: string
  is_admin: boolean
  privileges: Record<string, unknown>
}

// Admin-only operations (routes/auth_routes.py + admin_wipe_routes.py).
export function useAdmin() {
  const { request } = useApi()
  const users = useState<AdminUser[]>('admin-users', () => [])

  async function fetchUsers() {
    const r = await request<{ users: AdminUser[] }>('/api/auth/users')
    users.value = r.users ?? []
  }

  function createUser(username: string, password: string, is_admin: boolean) {
    return request('/api/auth/users', { method: 'POST', body: { username, password, is_admin } })
  }

  function deleteUser(username: string) {
    return request('/api/auth/users', { method: 'DELETE', body: { username } })
  }

  function setPrivileges(username: string, privileges: Record<string, unknown>) {
    return request<{ ok: boolean; privileges: Record<string, unknown> }>(
      `/api/auth/users/${username}/privileges`, { method: 'PUT', body: privileges },
    )
  }

  function wipe(kind: string) {
    return request<{ status: string; kind: string; count: number }>(`/api/admin/wipe/${kind}`, { method: 'DELETE' })
  }

  return { users, fetchUsers, createUser, deleteUser, setPrivileges, wipe }
}

export const PRIVILEGE_KEYS = [
  'can_use_agent',
  'can_use_browser',
  'can_use_bash',
  'can_use_documents',
  'can_use_research',
  'can_generate_images',
  'can_manage_memory',
] as const

export const WIPE_KINDS = [
  'chats', 'memory', 'skills', 'notes', 'tasks', 'documents', 'gallery', 'calendar',
] as const
