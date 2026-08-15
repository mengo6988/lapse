/**
 * POST /trackers — the name-first add flow's only required call
 * (docs/spec.md § API). On success the new Tracker is grafted straight into
 * the bootstrap cache (src/client/query/bootstrapCache.ts) so home/list
 * see it without a refetch.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { addTracker, type TrackerMutationResponse } from '../query/bootstrapCache'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { jsonRequest, mutationFetch } from './mutationClient'

export interface CreateTrackerInput {
  name: string
  categoryId?: string | null
  thresholdDays?: number | null
  variants?: { name: string; thresholdDays?: number | null }[]
}

export function useCreateTracker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTrackerInput) =>
      mutationFetch('/api/trackers', jsonRequest('POST', input)) as Promise<TrackerMutationResponse>,
    onSuccess: (response) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) => (old ? addTracker(old, response) : old))
    },
  })
}
