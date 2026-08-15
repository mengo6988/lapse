/**
 * The mount hook that keeps the offline outbox draining in the foreground
 * (build ticket 17: Background Sync is unavailable on iOS, so nothing here
 * can rely on a service worker to retry once the tab is gone). Mounted once
 * by src/client/shell/AppShell.tsx.
 *
 * It takes no arguments, returns nothing, and renders nothing — this is
 * pure lifecycle plumbing wiring entryOutbox.ts (which owns sending one
 * pass) to outboxStore.ts (which owns the queue and its change
 * notifications). Nothing in either of those two modules knows this hook
 * exists, which is exactly the one-way dependency outboxStore.ts's header
 * comment asks for: this file is the only place that turns "the queue
 * changed" (or "we might be back online", or "the tab is visible again")
 * into "try sending it".
 *
 * Triggers, per the ticket: mount (after rehydrating from IndexedDB via
 * loadOutbox), every outboxStore change (this is also how build ticket 19's
 * retry-all reaches the network — it just flips dead items back to pending
 * and this hook's subscription notices), the browser `online` event, and
 * `visibilitychange` when the tab becomes visible. A pass that stops on a
 * retryable failure (network error or 5xx) schedules exactly one more
 * attempt after `backoff(attempts)`; any of the other triggers firing first
 * cancels that wait and tries immediately instead, on the theory that "the
 * user is looking at this again" or "the tab just came online" is a better
 * reason to retry now than an arbitrary jittered delay.
 */
import { useEffect } from 'react'
import { backoff } from './backoff'
import { drainOutboxOnce } from './entryOutbox'
import { loadOutbox, outboxStore } from './outboxStore'

export function useOutboxDrain(): void {
  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function clearRetryTimer() {
      if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    /**
     * Clearing the pending retry *before* attempting, rather than after,
     * keeps two overlapping calls from ever racing to clear each other's
     * freshly-scheduled timer: whichever call is "in progress" only ever
     * sets a new timer inside its own `.then`, and only the call that is
     * actually running right now can still be waiting on that `.then` by
     * the time it fires.
     */
    function drain() {
      clearRetryTimer()
      void drainOutboxOnce().then((result) => {
        if (cancelled || result.retryAfterAttempts === null) return
        retryTimer = setTimeout(drain, backoff(result.retryAfterAttempts))
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') drain()
    }

    void loadOutbox().then(() => {
      if (!cancelled) drain()
    })

    const unsubscribe = outboxStore.subscribe(drain)
    window.addEventListener('online', drain)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearRetryTimer()
      unsubscribe()
      window.removeEventListener('online', drain)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
