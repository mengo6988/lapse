import { describe, expect, it } from 'vitest'
import { BACKOFF_BASE_MS, BACKOFF_CAP_MS, backoff } from './backoff'

describe('backoff', () => {
  it('is 0 when the injected random source returns 0, at any attempt count', () => {
    expect(backoff(0, () => 0)).toBe(0)
    expect(backoff(1, () => 0)).toBe(0)
    expect(backoff(9, () => 0)).toBe(0)
  })

  it('doubles the upper bound with each attempt while under the cap', () => {
    expect(backoff(0, () => 1)).toBe(BACKOFF_BASE_MS)
    expect(backoff(1, () => 1)).toBe(BACKOFF_BASE_MS * 2)
    expect(backoff(2, () => 1)).toBe(BACKOFF_BASE_MS * 4)
    expect(backoff(3, () => 1)).toBe(BACKOFF_BASE_MS * 8)
  })

  it('caps the upper bound at BACKOFF_CAP_MS once base * 2^attempts would exceed it', () => {
    // base(2000) * 2^5 = 64000, already past the 60000 cap.
    expect(backoff(5, () => 1)).toBe(BACKOFF_CAP_MS)
    expect(backoff(20, () => 1)).toBe(BACKOFF_CAP_MS)
  })

  it('scales linearly with the injected random value below the cap (the "full jitter" shape)', () => {
    expect(backoff(1, () => 0.5)).toBe(BACKOFF_BASE_MS * 2 * 0.5)
    expect(backoff(1, () => 0.25)).toBe(BACKOFF_BASE_MS * 2 * 0.25)
  })

  it('defaults to Math.random when no source is given, staying within [0, upper bound]', () => {
    for (let attempts = 0; attempts < 4; attempts++) {
      const upperBound = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempts)
      const delay = backoff(attempts)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(upperBound)
    }
  })
})
