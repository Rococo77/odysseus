import type { Memory, MemoryListResponse } from '~/types/memory'

// Reactive store + typed client for /api/memory. Mirrors the legacy
// static/js/memory.js CRUD. Create takes JSON; update/pin use form-encoded
// bodies (FastAPI Form). Create returns only {ok,count}, so we re-fetch.
export function useMemory() {
  const { request } = useApi()

  const memories = useState<Memory[]>('memories', () => [])
  const loading = useState<boolean>('memories-loading', () => false)
  const error = useState<string | null>('memories-error', () => null)

  async function fetchMemories() {
    loading.value = true
    error.value = null
    try {
      const res = await request<MemoryListResponse>('/api/memory')
      memories.value = res.memory ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load memories'
    } finally {
      loading.value = false
    }
  }

  async function createMemory(text: string, category: string) {
    await request('/api/memory/add', {
      method: 'POST',
      body: { text, category, source: 'user' },
    })
    await fetchMemories()
  }

  async function updateMemory(id: string, text: string, category: string) {
    await request(`/api/memory/${id}`, {
      method: 'PUT',
      body: new URLSearchParams({ text, category }),
    })
    const m = memories.value.find(m => m.id === id)
    if (m) { m.text = text; m.category = category }
  }

  async function deleteMemory(id: string) {
    await request(`/api/memory/${id}`, { method: 'DELETE' })
    memories.value = memories.value.filter(m => m.id !== id)
  }

  async function togglePin(id: string) {
    const m = memories.value.find(m => m.id === id)
    const next = !(m?.pinned)
    await request(`/api/memory/${id}/pin`, {
      method: 'POST',
      body: new URLSearchParams({ pinned: String(next) }),
    })
    if (m) m.pinned = next
  }

  return {
    memories,
    loading,
    error,
    fetchMemories,
    createMemory,
    updateMemory,
    deleteMemory,
    togglePin,
  }
}
