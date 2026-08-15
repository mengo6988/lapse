/**
 * Immutable removal of a hard-deleted Tracker from the bootstrap query
 * cache, mirroring the cache-surgery style of src/client/tracker/
 * bootstrapCache.ts (which this ticket may import but not edit) —
 * `DELETE /trackers/:id` returns no body (204), so there is nothing to graft
 * back on, only a filter.
 */
import type { BootstrapPayload } from '../api'

export function removeTrackerFromCache(payload: BootstrapPayload, trackerId: string): BootstrapPayload {
  return { ...payload, trackers: payload.trackers.filter((tracker) => tracker.id !== trackerId) }
}
