import { describe, it, expect } from 'vitest'
import { formatUnix, categoryClasses } from '~/utils/memory'

describe('formatUnix', () => {
  it('returns a dash for empty/zero', () => {
    expect(formatUnix(0)).toBe('—')
    expect(formatUnix(null)).toBe('—')
    expect(formatUnix(undefined)).toBe('—')
  })
  it('formats a real timestamp', () => {
    const out = formatUnix(1_700_000_000)
    expect(out).not.toBe('—')
    expect(out).toMatch(/\d/)
  })
})

describe('categoryClasses', () => {
  it('maps known categories', () => {
    expect(categoryClasses('identity')).toContain('text-accent')
    expect(categoryClasses('task')).toContain('text-red')
  })
  it('falls back for unknown categories', () => {
    expect(categoryClasses('whatever')).toBe('border-border text-muted')
  })
})
