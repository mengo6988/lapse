import { describe, expect, it } from 'vitest'
import type { PendingVariant } from './PendingVariantsEditor'
import { buildVariantsPayload, remapVariantFieldErrors } from './pendingVariantsPayload'

describe('buildVariantsPayload', () => {
  it('drops blank drafts and trims kept names', () => {
    const pending: PendingVariant[] = [
      { localId: 'a', name: '  front  ', thresholdDays: 7 },
      { localId: 'b', name: '', thresholdDays: null },
      { localId: 'c', name: 'rear', thresholdDays: null },
    ]

    const { payload } = buildVariantsPayload(pending)

    expect(payload).toEqual([
      { name: 'front', thresholdDays: 7 },
      { name: 'rear', thresholdDays: null },
    ])
  })

  it('records each kept row original index, so a blank row in between shifts the mapping', () => {
    const pending: PendingVariant[] = [
      { localId: 'a', name: '', thresholdDays: null }, // index 0, dropped
      { localId: 'b', name: 'front', thresholdDays: null }, // index 1 -> payload 0
      { localId: 'c', name: 'rear', thresholdDays: null }, // index 2 -> payload 1
    ]

    const { originalIndexByPayloadIndex } = buildVariantsPayload(pending)

    expect(originalIndexByPayloadIndex).toEqual([1, 2])
  })
})

describe('remapVariantFieldErrors', () => {
  it('points a variants.<payloadIndex>.<field> error back at the original row index', () => {
    const remapped = remapVariantFieldErrors({ 'variants.0.name': 'too long' }, [1, 2])

    expect(remapped).toEqual({ 'variants.1.name': 'too long' })
  })

  it('leaves non-variant field errors (name, categoryId, thresholdDays) untouched', () => {
    const remapped = remapVariantFieldErrors({ name: 'required' }, [])

    expect(remapped).toEqual({ name: 'required' })
  })

  it('drops an error for a payload index with no known original row', () => {
    const remapped = remapVariantFieldErrors({ 'variants.5.name': 'x' }, [1, 2])

    expect(remapped).toEqual({})
  })
})
