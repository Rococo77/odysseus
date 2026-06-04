import type {
  GalleryImage, GalleryAlbum, LibraryResponse, LibraryFilters, GalleryPatch,
} from '~/types/gallery'

// Reactive store + typed client for /api/gallery. Mirrors the core library
// operations of the legacy static/js/gallery.js: paginated list with filters,
// upload, favorite/tags/album edits, rename, rotate, delete, plus albums.
const PAGE = 24

export function useGallery() {
  const { request } = useApi()

  const items = useState<GalleryImage[]>('gallery-items', () => [])
  const albums = useState<GalleryAlbum[]>('gallery-albums', () => [])
  const tags = useState<string[]>('gallery-tags', () => [])
  const models = useState<string[]>('gallery-models', () => [])
  const total = useState<number>('gallery-total', () => 0)
  const loading = useState<boolean>('gallery-loading', () => false)
  const error = useState<string | null>('gallery-error', () => null)
  const filters = useState<LibraryFilters>('gallery-filters', () => ({ sort: 'recent' }))
  const offset = useState<number>('gallery-offset', () => 0)

  const hasMore = computed(() => items.value.length < total.value)

  function buildQuery(off: number): string {
    const f = filters.value
    const p = new URLSearchParams()
    p.set('offset', String(off))
    p.set('limit', String(PAGE))
    if (f.search) p.set('search', f.search)
    if (f.tag) p.set('tag', f.tag)
    if (f.model) p.set('model', f.model)
    if (f.album) p.set('album', f.album)
    if (f.favorites) p.set('favorites', 'true')
    if (f.sort) p.set('sort', f.sort)
    return p.toString()
  }

  /** Fetch the first page for the current filters (replaces the list). */
  async function fetchLibrary() {
    loading.value = true
    error.value = null
    offset.value = 0
    try {
      const res = await request<LibraryResponse>(`/api/gallery/library?${buildQuery(0)}`)
      items.value = res.items
      total.value = res.total
      tags.value = res.tags
      models.value = res.models
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load gallery'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    loading.value = true
    try {
      const next = offset.value + PAGE
      const res = await request<LibraryResponse>(`/api/gallery/library?${buildQuery(next)}`)
      items.value = [...items.value, ...res.items]
      offset.value = next
      total.value = res.total
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load more'
    } finally {
      loading.value = false
    }
  }

  function setFilters(patch: Partial<LibraryFilters>) {
    filters.value = { ...filters.value, ...patch }
    return fetchLibrary()
  }

  async function upload(files: FileList | File[]): Promise<{ uploaded: number; duplicates: number }> {
    let uploaded = 0, duplicates = 0
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      if (filters.value.album) fd.append('album_id', filters.value.album)
      const res = await request<{ ok: boolean; duplicate?: boolean }>('/api/gallery/upload', { method: 'POST', body: fd })
      if (res.duplicate) duplicates++
      else if (res.ok) uploaded++
    }
    await fetchLibrary()
    return { uploaded, duplicates }
  }

  async function patchImage(id: string, body: GalleryPatch): Promise<GalleryImage> {
    const updated = await request<GalleryImage>(`/api/gallery/${id}`, { method: 'PATCH', body })
    const i = items.value.findIndex(x => x.id === id)
    if (i !== -1) items.value[i] = updated
    return updated
  }

  function toggleFavorite(img: GalleryImage) {
    return patchImage(img.id, { favorite: !img.favorite })
  }

  async function rename(id: string, name: string) {
    await request(`/api/gallery/${id}/rename`, { method: 'POST', body: { name } })
    const img = items.value.find(x => x.id === id)
    if (img) img.prompt = name
  }

  async function rotate(id: string, angle: 90 | -90 | 180) {
    const res = await request<{ width: number; height: number }>(`/api/gallery/${id}/rotate`, { method: 'POST', body: { angle } })
    const img = items.value.find(x => x.id === id)
    if (img) { img.width = res.width; img.height = res.height }
  }

  async function deleteImage(id: string) {
    await request(`/api/gallery/${id}`, { method: 'DELETE' })
    items.value = items.value.filter(x => x.id !== id)
    total.value = Math.max(0, total.value - 1)
  }

  async function fetchAlbums() {
    const res = await request<{ albums: GalleryAlbum[] }>('/api/gallery/albums')
    albums.value = res.albums
  }

  async function createAlbum(name: string, description = '') {
    await request('/api/gallery/albums', { method: 'POST', body: { name, description } })
    await fetchAlbums()
  }

  return {
    items, albums, tags, models, total, loading, error, filters, hasMore,
    fetchLibrary, loadMore, setFilters,
    upload, patchImage, toggleFavorite, rename, rotate, deleteImage,
    fetchAlbums, createAlbum,
  }
}
