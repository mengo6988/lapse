/**
 * Exponential backoff with full jitter (build ticket 17): the delay before
 * the next drain attempt is `random(0, min(cap, base * 2^attempts))`, not a
 * fixed exponential curve. Full jitter (rather than "exponential + a bit of
 * randomness") matters here specifically because a network blip tends to
 * knock out every queued item's next attempt at once — without the spread,
 * every item (and every open tab, since there's no leader election) would
 * retry on the same tick and hit the server in the same burst it's still
 * recovering from.
 *
 * `random` is injectable so the test can assert exact bounds instead of a
 * flaky range; drainOutbox's caller (src/client/outbox/useOutboxDrain.ts)
 * always calls this with just `attempts` and gets `Math.random`.
 *
 * BASE_MS/CAP_MS are sized for a foreground-only drain (docs/tech-stack.md §
 * Offline-lite: Background Sync is unavailable on iOS, so nothing retries
 * while the app isn't open). 2s is short enough that a one-off blip clears
 * within the same session; 60s keeps the longest silence between attempts
 * well inside "the user might still be looking at the app".
 */
export const BACKOFF_BASE_MS = 2000
export const BACKOFF_CAP_MS = 60000

export function backoff(attempts: number, random: () => number = Math.random): number {
  const upperBound = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempts)
  return random() * upperBound
}
