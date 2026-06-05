import { describe, it, expect } from 'vitest'
import { extractApiError } from '~/utils/apiError'

describe('extractApiError', () => {
  it('prefers FastAPI detail string', () => {
    expect(extractApiError({ statusCode: 400, data: { detail: 'bad input' } })).toBe('bad input')
  })

  it('reads custom message (e.g. SESSION_STARRED)', () => {
    expect(extractApiError({ statusCode: 403, data: { error: 'SESSION_STARRED', message: 'Unstar first' } }))
      .toBe('Unstar first')
  })

  it('handles 422 validation arrays', () => {
    expect(extractApiError({ statusCode: 422, data: { detail: [{ msg: 'field required', loc: ['body', 'x'] }] } }))
      .toBe('field required')
  })

  it('maps auth statuses', () => {
    expect(extractApiError({ statusCode: 401 })).toMatch(/authorized/i)
    expect(extractApiError({ statusCode: 403, data: {} })).toMatch(/authorized/i)
  })

  it('falls back to status code', () => {
    expect(extractApiError({ statusCode: 500, data: {} })).toBe('Request failed (500)')
  })

  it('detects network errors when no response', () => {
    expect(extractApiError({ name: 'FetchError', message: 'Failed to fetch' })).toMatch(/network/i)
  })

  it('accepts a plain string body', () => {
    expect(extractApiError({ statusCode: 400, data: 'nope' })).toBe('nope')
  })
})
