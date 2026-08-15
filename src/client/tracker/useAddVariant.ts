/** POST /trackers/:id/variants — adding a row to an existing Tracker in the edit flow. */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { addVariant, type VariantMutationResponse } from '../query/bootstrapCache'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { jsonRequest, mutationFetch } from './mutationClient'

export interface AddVariantInput {
  trackerId: string
  name: string
  thresholdDays?: number | null
}

export function useAddVariant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ trackerId, ...body }: AddVariantInput) =>
      mutationFetch(`/api/trackers/${trackerId}/variants`, jsonRequest('POST', body)) as Promise<VariantMutationResponse>,
    onSuccess: (response) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) =>
        old ? addVariant(old, response.trackerId, response) : old,
      )
    },
  })
}
