import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInfiniteScrollSentinel } from './useInfiniteScrollSentinel'

/**
 * jsdom has no IntersectionObserver at all — mirrors
 * src/client/detail/useInfiniteScrollSentinel.test.tsx's fake, which
 * captures the constructor callback so a test can fire it manually,
 * standing in for the browser actually scrolling the sentinel into view.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }

  observe(el: Element) {
    this.observed.push(el)
  }

  unobserve() {}
  disconnect() {}

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function Probe({ onIntersect, enabled }: { onIntersect: () => void; enabled: boolean }) {
  const ref = useInfiniteScrollSentinel(onIntersect, enabled)
  return <div ref={ref} data-testid="sentinel" />
}

describe('useInfiniteScrollSentinel', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls onIntersect once the sentinel intersects', () => {
    const onIntersect = vi.fn()
    render(<Probe onIntersect={onIntersect} enabled />)

    const [observer] = FakeIntersectionObserver.instances
    act(() => observer!.trigger(true))

    expect(onIntersect).toHaveBeenCalledTimes(1)
  })

  it('does not call onIntersect for a non-intersecting callback', () => {
    const onIntersect = vi.fn()
    render(<Probe onIntersect={onIntersect} enabled />)

    const [observer] = FakeIntersectionObserver.instances
    act(() => observer!.trigger(false))

    expect(onIntersect).not.toHaveBeenCalled()
  })

  it('does not observe anything while disabled', () => {
    const onIntersect = vi.fn()
    render(<Probe onIntersect={onIntersect} enabled={false} />)

    expect(FakeIntersectionObserver.instances).toHaveLength(0)
  })

  it('always calls the latest onIntersect, even if the prop changes after mount', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Probe onIntersect={first} enabled />)
    rerender(<Probe onIntersect={second} enabled />)

    const [observer] = FakeIntersectionObserver.instances
    act(() => observer!.trigger(true))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
