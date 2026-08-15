/**
 * A bottom-of-list sentinel that calls `onIntersect` when it scrolls into
 * view — the infinite-scroll half of build ticket 21's cursor pagination.
 * `IntersectionObserver` isn't implemented in jsdom (see
 * useInfiniteScrollSentinel.test.tsx), so this is written against the real
 * browser API and exercised in tests via a fake that captures the
 * constructor callback. Duplicates
 * src/client/detail/useInfiniteScrollSentinel.ts byte-for-byte in behavior
 * — not exported from src/client/detail/index.ts, and this ticket's file
 * fence can't reach that directory to add the export.
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
