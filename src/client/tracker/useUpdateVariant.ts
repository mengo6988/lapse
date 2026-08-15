/**
 * PATCH /variants/:id — rename a Variant, or set/clear its per-Variant
 * Threshold override. `thresholdDays: null` means inherit the parent
 * (docs/spec.md § Domain rules).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { patchVariantInCache, type VariantMutationResponse } from './bootstrapCache'
import { jsonRequest, mutationFetch } from './mutationClient'

export interface UpdateVariantInput {
  variantId: string
  name?: string
  thresholdDays?: number | null
}

export function useUpdateVariant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId, ...patch }: UpdateVariantInput) =>
      mutationFetch(`/api/variants/${variantId}`, jsonRequest('PATCH', patch)) as Promise<VariantMutationResponse>,
    onSuccess: (response) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) =>
        old ? patchVariantInCache(old, response.trackerId, response) : old,
      )
    },
  })
}
