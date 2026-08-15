/**
 * PATCH /trackers/:id — rename, change Category/Threshold, archive/unarchive
 * all go through this one endpoint (docs/spec.md § API). Archiving is just
 * `{ archived: true }`: the server sets `archivedAt`, history is untouched,
 * and home/list filtering is those tickets' job, not this hook's.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { patchTracker, type TrackerMutationResponse } from '../query/bootstrapCache'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { jsonRequest, mutationFetch } from './mutationClient'

export interface UpdateTrackerInput {
  id: string
  name?: string
  categoryId?: string | null
  thresholdDays?: number | null
  archived?: boolean
}

export function useUpdateTracker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTrackerInput) =>
      mutationFetch(`/api/trackers/${id}`, jsonRequest('PATCH', patch)) as Promise<TrackerMutationResponse>,
    onSuccess: (response) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) => (old ? patchTracker(old, response) : old))
    },
  })
}
