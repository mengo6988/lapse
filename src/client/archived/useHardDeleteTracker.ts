/**
 * DELETE /trackers/:id — hard delete, archived Trackers only (docs/spec.md §
 * API; the server 409s if the Tracker isn't archived, src/server/routes/
 * trackers.ts). Reuses `mutationFetch`/`TrackerApiError` from
 * src/client/tracker/mutationClient.ts rather than a second error-parsing
 * path. The response is empty (204), so the cache update only needs the id
 * the caller already had.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { removeTracker } from '../query/bootstrapCache'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { mutationFetch } from '../tracker/mutationClient'

export function useHardDeleteTracker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (trackerId: string) => mutationFetch(`/api/trackers/${trackerId}`, { method: 'DELETE' }),
    onSuccess: (_response, trackerId) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) =>
        old ? removeTracker(old, trackerId) : old,
      )
    },
  })
}
