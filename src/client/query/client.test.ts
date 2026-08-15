import { describe, expect, it } from 'vitest'
import { createQueryClient, QUERY_CACHE_MAX_AGE_MS } from './client'

describe('createQueryClient', () => {
  it('sets gcTime at least as long as the persisted cache max age, so a query is never evicted before it can be persisted', () => {
    const queryClient = createQueryClient()

    const gcTime = queryClient.getDefaultOptions().queries?.gcTime
    expect(gcTime).toBeTypeOf('number')
    expect(gcTime as number).toBeGreaterThanOrEqual(QUERY_CACHE_MAX_AGE_MS)
  })

  it('creates an independent client on each call', () => {
    const a = createQueryClient()
    const b = createQueryClient()

    expect(a).not.toBe(b)
  })
})
