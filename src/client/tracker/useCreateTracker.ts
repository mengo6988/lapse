/**
 * POST /trackers — the name-first add flow's only required call
 * (docs/spec.md § API). On success the new Tracker is grafted straight into
 * the bootstrap cache (src/client/query/bootstrapCache.ts) so home/list
 * see it without a refetch.
 */
import { addTracker, type TrackerMutationResponse } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface CreateTrackerInput {
  name: string
  categoryId?: string | null
  thresholdDays?: number | null
  variants?: { name: string; thresholdDays?: number | null }[]
}

export function useCreateTracker() {
  return useBootstrapWrite<CreateTrackerInput, TrackerMutationResponse>({
    route: '/api/trackers',
    method: 'POST',
    onSuccess: { kind: 'graft', graft: addTracker },
  })
}
