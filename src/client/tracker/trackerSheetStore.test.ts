import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { trackerSheetStore, useTrackerSheetState } from './trackerSheetStore'

describe('trackerSheetStore', () => {
  afterEach(() => {
    trackerSheetStore.close()
  })

  it('starts closed', () => {
    expect(trackerSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('openCreate moves to create mode and captures the currently focused element', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    trackerSheetStore.openCreate()

    expect(trackerSheetStore.read()).toEqual({ mode: 'create', openedFrom: button })
    button.remove()
  })

  it('openEdit moves to edit mode for the given tracker, also capturing the opener', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    trackerSheetStore.openEdit('t1')

    expect(trackerSheetStore.read()).toEqual({ mode: 'edit', trackerId: 't1', openedFrom: button })
    button.remove()
  })

  it('close returns to closed from either mode', () => {
    trackerSheetStore.openEdit('t1')
    trackerSheetStore.close()
    expect(trackerSheetStore.read()).toEqual({ mode: 'closed' })
  })
})

describe('useTrackerSheetState', () => {
  afterEach(() => {
    trackerSheetStore.close()
  })

  it('re-renders subscribers on every transition', () => {
    const { result } = renderHook(() => useTrackerSheetState())
    expect(result.current).toEqual({ mode: 'closed' })

    act(() => trackerSheetStore.openCreate())
    expect(result.current.mode).toBe('create')

    act(() => trackerSheetStore.openEdit('t9'))
    expect(result.current).toMatchObject({ mode: 'edit', trackerId: 't9' })

    act(() => trackerSheetStore.close())
    expect(result.current).toEqual({ mode: 'closed' })
  })
})
