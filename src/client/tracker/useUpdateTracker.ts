/**
 * PATCH /trackers/:id — rename, change Category/Threshold, archive/unarchive
 * all go through this one endpoint (docs/spec.md § API). Archiving is just
 * `{ archived: true }`: the server sets `archivedAt`, history is untouched,
 * and home/list filtering is those tickets' job, not this hook's.
 */
import { patchTracker, type TrackerMutationResponse } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface UpdateTrackerInput {
  id: string
  name?: string
  categoryId?: string | null
  thresholdDays?: number | null
  archived?: boolean
}

export function useUpdateTracker() {
  return useBootstrapWrite<UpdateTrackerInput, TrackerMutationResponse>({
    route: (input) => `/api/trackers/${input.id}`,
    method: 'PATCH',
    body: ({ id, ...patch }) => patch,
    onSuccess: { kind: 'graft', graft: patchTracker },
  })
}
