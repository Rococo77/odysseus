// TypeScript types for the /api/gallery contract (routes/gallery_routes.py,
// routes/gallery_helpers.py::_image_to_dict).

export type GallerySort = 'recent' | 'oldest' | 'shuffle'

export interface GalleryImage {
  id: string
  filename: string
  url: string // /api/generated-image/{filename}
  prompt: string | null
  model: string | null
  size: string | null
  quality: string | null
  tags: string // comma-separated user tags
  ai_tags: string // comma-separated AI tags
  user_tags: string
  session_id: string | null
  session_name: string | null
  album_id: string | null
  is_active: boolean
  favorite: boolean
  taken_at: string | null
  camera: string | null
  gps: { lat: string | null; lng: string | null } | null
  width: number | null
  height: number | null
  file_size: number | null
  created_at: string | null
  updated_at: string | null
}

export interface GalleryAlbum {
  id: string
  name: string
  description: string
  cover_url: string | null
  count: number
  created_at: string | null
}

export interface LibraryResponse {
  items: GalleryImage[]
  total: number
  total_tagged: number
  tags: string[]
  models: string[]
}

export interface LibraryFilters {
  search?: string
  tag?: string
  model?: string
  album?: string
  favorites?: boolean
  sort?: GallerySort
}

/** PATCH /api/gallery/{id} body. */
export interface GalleryPatch {
  tags?: string
  favorite?: boolean
  album_id?: string | null
}
