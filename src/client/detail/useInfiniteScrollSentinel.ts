/**
 * A bottom-of-list sentinel that calls `onIntersect` when it scrolls into
 * view — the "loads the next page on scroll" half of ticket 15's cursor
 * pagination requirement. `IntersectionObserver` isn't implemented in
 * jsdom (see useInfiniteScrollSentinel.test.tsx), so this is written
 * against the real browser API and exercised in tests via a fake that
 * captures the constructor callback.
 */
import { useEffect, useRef } from 'react'

export function useInfiniteScrollSentinel(onIntersect: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Held in a ref so the observer effect below only depends on `enabled` —
  // re-creating the observer on every render (e.g. because onIntersect is a
  // fresh closure each time) would be wasteful and can miss an
  // already-in-flight intersection.
  const onIntersectRef = useRef(onIntersect)
  useEffect(() => {
    onIntersectRef.current = onIntersect
  })

  useEffect(() => {
    if (!enabled) return
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onIntersectRef.current()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])

  return sentinelRef
}
