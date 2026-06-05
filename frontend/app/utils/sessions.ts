import type { Session } from '~/types/sessions'

export type SortMode = 'active' | 'newest' | 'alpha'

/** Effective "last activity" timestamp (ms), mirroring the backend fallback
 *  chain: last_message_at → updated_at → created_at. */
export function lastActivity(s: Session): number {
  const iso = s.last_message_at || s.updated_at || s.created_at
  const t = iso ? new Date(iso).getTime() : 0
  return Number.isNaN(t) ? 0 : t
}

/** Sort a copy of the list by mode, floating starred sessions to the top. */
export function sortSessions(list: Session[], mode: SortMode): Session[] {
  const cmp = (a: Session, b: Session): number => {
    if (a.is_important !== b.is_important) return a.is_important ? -1 : 1
    switch (mode) {
      case 'newest':
        return (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0)
      case 'alpha':
        return a.name.localeCompare(b.name)
      case 'active':
      default:
        return lastActivity(b) - lastActivity(a)
    }
  }
  return [...list].sort(cmp)
}

export interface SessionGroup {
  folder: string | null
  sessions: Session[]
}

/** Group sessions by folder (null folder last), each group internally sorted. */
export function groupByFolder(list: Session[], mode: SortMode): SessionGroup[] {
  const map = new Map<string | null, Session[]>()
  for (const s of list) {
    const key = s.folder || null
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  const groups: SessionGroup[] = [...map.entries()].map(([folder, sessions]) => ({
    folder,
    sessions: sortSessions(sessions, mode),
  }))
  // Named folders first (alpha), unfiled (null) last.
  groups.sort((a, b) => {
    if (a.folder === null) return 1
    if (b.folder === null) return -1
    return a.folder.localeCompare(b.folder)
  })
  return groups
}
