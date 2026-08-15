import { describe, expect, it } from 'vitest'
import { bootstrapPayloadSchema } from './types'

const validPayload = {
  categories: [{ id: 'cat-1', name: 'house', color: '#89b4fa', createdAt: '2026-01-01T00:00:00.000Z' }],
  trackers: [
    {
      id: 'trk-1',
      name: 'vacuum',
      categoryId: 'cat-1',
      thresholdDays: 14,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: {
        id: 'ent-1',
        trackerId: 'trk-1',
        variantId: null,
        occurredAt: '2026-01-10T00:00:00.000Z',
        durationMinutes: null,
        note: null,
        createdAt: '2026-01-10T00:00:00.000Z',
      },
      variants: [
        {
          id: 'var-1',
          name: 'volvo',
          thresholdDays: null,
          latestEntry: null,
        },
      ],
    },
  ],
}

describe('bootstrapPayloadSchema', () => {
  it('parses a well-formed bootstrap payload', () => {
    expect(bootstrapPayloadSchema.parse(validPayload)).toEqual(validPayload)
  })

  it('parses the empty-state payload', () => {
    const empty = { categories: [], trackers: [] }
    expect(bootstrapPayloadSchema.parse(empty)).toEqual(empty)
  })

  it('rejects a payload missing the trackers array', () => {
    const { trackers: _trackers, ...malformed } = validPayload
    expect(() => bootstrapPayloadSchema.parse(malformed)).toThrow()
  })

  it('rejects a tracker with the wrong type for thresholdDays', () => {
    const malformed = {
      ...validPayload,
      trackers: [{ ...validPayload.trackers[0], thresholdDays: '14' }],
    }
    expect(() => bootstrapPayloadSchema.parse(malformed)).toThrow()
  })
})
