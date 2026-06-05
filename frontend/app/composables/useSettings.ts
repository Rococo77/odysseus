// Per-user preferences (/api/prefs) and admin server settings
// (/api/auth/settings). Server settings are read in full and written back in
// full so unedited keys are preserved.
export function useSettings() {
  const { request } = useApi()

  // --- Per-user prefs ---
  function getPrefs() {
    return request<Record<string, unknown>>('/api/prefs')
  }
  function setPref(key: string, value: unknown) {
    return request<{ key: string; value: unknown }>(`/api/prefs/${key}`, { method: 'PUT', body: { value } })
  }

  // --- Server settings (admin) ---
  function getSettings() {
    return request<Record<string, unknown>>('/api/auth/settings')
  }
  function saveSettings(full: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/auth/settings', { method: 'POST', body: full })
  }

  return { getPrefs, setPref, getSettings, saveSettings }
}
