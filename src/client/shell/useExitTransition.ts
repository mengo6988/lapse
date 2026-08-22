import { useEffect, useState } from 'react'

/**
 * How long a dismissed element stays mounted so its exit animation can play.
 * Matches the `var(--duration-fade)` every *-out keyframe runs at
 * (src/client/styles/tokens.css). jsdom runs no CSS, so the unmount is
 * driven by this timer, never by animationend — tests advance the same
 * clock the browser does.
 */
export const EXIT_DURATION_MS = 200

/**
 * Holds the last non-null value for EXIT_DURATION_MS after it flips to null,
 * so a conditionally rendered element (sheet, toast, chip) can play an exit
 * animation before unmounting. Close paths stay untouched: the owning store
 * or state flips to closed exactly as before, and the consumer keeps
 * rendering the latched value with a `--closing`/`--out` class until the
 * timer clears it. Reopening during the exit window cancels the unmount and
 * passes the new value straight through.
 */
export function useExitTransition<T>(current: T | null): { value: T | null; closing: boolean } {
  const [latched, setLatched] = useState(current)

  useEffect(() => {
    if (current !== null) {
      setLatched(current)
      return
    }
    const timer = setTimeout(() => setLatched(null), EXIT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [current])

  return { value: current ?? latched, closing: current === null && latched !== null }
}
