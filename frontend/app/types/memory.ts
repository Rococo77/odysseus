// TypeScript types for the /api/memory contract (routes/memory_routes.py).
// Memory entries are dicts from the memory manager, not the bare DB row.

/** Common categories; the field is an open string set on the backend. */
export type MemoryCategory =
  | 'fact'
  | 'identity'
  | 'preference'
  | 'contact'
  | 'project'
  | 'goal'
  | 'task'
  | (string & {})

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  'fact', 'identity', 'preference', 'contact', 'project', 'goal', 'task',
]

export interface Memory {
  id: string
  text: string
  category: MemoryCategory
  source: string
  owner: string | null
  session_id: string | null
  timestamp: number // Unix seconds
  pinned?: boolean
  categories?: string[]
}

export interface MemoryListResponse {
  memory: Memory[]
}
