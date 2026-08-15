import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * calls `onOpen` whenever the URL carries `?search=open` — the header
 * magnifier's contract (src/client/shell/Header.tsx always navigates to
 * `/list?search=open`, even when already on /list). callback-driven rather
 * than a returned boolean on purpose: a returned boolean derived straight
 * from `searchParams` gets clobbered by this same hook's own param-stripping
 * effect (the caller would see it flip back to `false` before ever reading
 * `true`), whereas a callback lets the caller own persistent local state
 * that isn't reset by the URL cleanup.
 *
 * stripping the param after firing matters too: without it, clicking the
 * magnifier a second time while still on /list would carry the exact same
 * URL as before, and this effect's `searchParams` dependency would never
 * see a change to fire on.
 */
export function useSearchOpenParam(onOpen: () => void): void {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('search') !== 'open') return
    onOpen()
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        next.delete('search')
        return next
      },
      { replace: true },
    )
    // onOpen is expected to be stable (useCallback) — including it keeps the
    // effect honest without causing extra fires, since it's a no-op once the
    // param is gone.
  }, [searchParams, setSearchParams, onOpen])
}
