/**
 * DELETE /trackers/:id — hard delete, archived Trackers only (docs/spec.md §
 * API; the server 409s if the Tracker isn't archived, src/server/routes/
 * trackers.ts). The response is empty (204), so the cache update only needs
 * the id the caller already had.
 */
import { removeTracker } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export function useHardDeleteTracker() {
  return useBootstrapWrite<string, null>({
    route: (trackerId) => `/api/trackers/${trackerId}`,
    method: 'DELETE',
    onSuccess: { kind: 'graft', graft: (payload, _response, trackerId) => removeTracker(payload, trackerId) },
  })
}
