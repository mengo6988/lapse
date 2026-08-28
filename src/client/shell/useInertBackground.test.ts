import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useInertBackground } from './useInertBackground'

describe('useInertBackground', () => {
  let appRoot: HTMLDivElement

  beforeEach(() => {
    appRoot = document.createElement('div')
    appRoot.id = 'app-root'
    document.body.appendChild(appRoot)
  })

  afterEach(() => {
    appRoot.remove()
  })

  it('does nothing while inactive', () => {
    renderHook(() => useInertBackground(false))
    expect(appRoot.hasAttribute('inert')).toBe(false)
  })

  it('marks #app-root inert while active, and clears it on unmount', () => {
    const { unmount } = renderHook(() => useInertBackground(true))
    expect(appRoot.hasAttribute('inert')).toBe(true)

    unmount()
    expect(appRoot.hasAttribute('inert')).toBe(false)
  })

  it('clears inert once the flag flips back to false without unmounting', () => {
    const { rerender } = renderHook(({ active }) => useInertBackground(active), {
      initialProps: { active: true },
    })
    expect(appRoot.hasAttribute('inert')).toBe(true)

    rerender({ active: false })
    expect(appRoot.hasAttribute('inert')).toBe(false)
  })

  it('keeps #app-root inert while any overlapping sheet is still active', () => {
    // two sheets active at once — e.g. one still latched through its exit
    // fade when a second opens — must not let one's cleanup un-inert the
    // root out from under the other.
    const first = renderHook(() => useInertBackground(true))
    const second = renderHook(() => useInertBackground(true))
    expect(appRoot.hasAttribute('inert')).toBe(true)

    first.unmount()
    expect(appRoot.hasAttribute('inert')).toBe(true)

    second.unmount()
    expect(appRoot.hasAttribute('inert')).toBe(false)
  })
})
