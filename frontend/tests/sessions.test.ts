import { describe, it, expect } from 'vitest'
import { sortSessions, groupByFolder, lastActivity } from '~/utils/sessions'
import type { Session } from '~/types/sessions'

const s = (over: Partial<Session>): Session => ({
  id: 'x', name: '', model: '', endpoint_url: '', rag: false, archived: false,
  folder: null, total_tokens: 0, is_important: false, created_at: null,
  updated_at: null, last_message_at: null, has_documents: false, has_images: false,
  mode: 'chat', message_count: 0, ...over,
} as Session)

describe('lastActivity', () => {
  it('falls back last_message_at → updated_at → created_at', () => {
    expect(lastActivity(s({ created_at: '2024-01-01T00:00:00Z' }))).toBeGreaterThan(0)
    expect(lastActivity(s({}))).toBe(0)
  })
})

describe('sortSessions', () => {
  it('floats starred to the top, then by recency', () => {
    const list = [
      s({ id: 'a', last_message_at: '2024-01-01T00:00:00Z' }),
      s({ id: 'b', last_message_at: '2024-03-01T00:00:00Z' }),
      s({ id: 'c', is_important: true, last_message_at: '2020-01-01T00:00:00Z' }),
    ]
    expect(sortSessions(list, 'active').map(x => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts alphabetically by name', () => {
    const list = [s({ id: '1', name: 'Beta' }), s({ id: '2', name: 'Alpha' })]
    expect(sortSessions(list, 'alpha').map(x => x.name)).toEqual(['Alpha', 'Beta'])
  })
})

describe('groupByFolder', () => {
  it('named folders alpha first, unfiled last', () => {
    const list = [
      s({ id: '1', folder: null }),
      s({ id: '2', folder: 'Work' }),
      s({ id: '3', folder: 'Admin' }),
    ]
    const groups = groupByFolder(list, 'active')
    expect(groups.map(g => g.folder)).toEqual(['Admin', 'Work', null])
  })
})
