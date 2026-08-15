import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { logSheetStore, useLogSheetState } from './logSheetStore'

describe('logSheetStore', () => {
  afterEach(() => {
    logSheetStore.close()
  })

  it('starts closed', () => {
    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('open() carries the target and the element the long-press fired from', () => {
    const button = document.createElement('button')

    logSheetStore.open({ trackerId: 't1', variantId: null }, button)

    expect(logSheetStore.read()).toEqual({
      mode: 'open',
      target: { trackerId: 't1', variantId: null },
      openedFrom: button,
    })
  })

  it('open() defaults openedFrom to null when the caller has no element to hand it', () => {
    logSheetStore.open({ trackerId: 't1', variantId: 'v1' })

    expect(logSheetStore.read()).toEqual({
      mode: 'open',
      target: { trackerId: 't1', variantId: 'v1' },
      openedFrom: null,
    })
  })

  it('close() returns to closed', () => {
    logSheetStore.open({ trackerId: 't1', variantId: null })
    logSheetStore.close()

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('a second open() replaces the first target', () => {
    logSheetStore.open({ trackerId: 't1', variantId: null })
    logSheetStore.open({ trackerId: 't2', variantId: 'v2' })

    expect(logSheetStore.read()).toEqual({
      mode: 'open',
      target: { trackerId: 't2', variantId: 'v2' },
      openedFrom: null,
    })
  })
})

describe('useLogSheetState', () => {
  afterEach(() => {
    logSheetStore.close()
  })

  it('re-renders subscribers on every transition', () => {
    const { result } = renderHook(() => useLogSheetState())
    expect(result.current).toEqual({ mode: 'closed' })

    act(() => logSheetStore.open({ trackerId: 't1', variantId: null }))
    expect(result.current).toMatchObject({ mode: 'open', target: { trackerId: 't1', variantId: null } })

    act(() => logSheetStore.close())
    expect(result.current).toEqual({ mode: 'closed' })
  })
})
