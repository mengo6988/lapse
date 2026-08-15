/**
 * DELETE /variants/:id — soft delete (docs/spec.md § Deletes: entries keep
 * their variantId so history keeps its label; no undelete UI in v1). The
 * response is empty (204), so the cache update needs the tracker/variant id
 * pair the caller already had rather than anything read off the response.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { removeVariant } from '../query/bootstrapCache'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { mutationFetch } from './mutationClient'

export interface RemoveVariantInput {
  trackerId: string
  variantId: string
}

export function useRemoveVariant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId }: RemoveVariantInput) => mutationFetch(`/api/variants/${variantId}`, { method: 'DELETE' }),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) =>
        old ? removeVariant(old, variables.trackerId, variables.variantId) : old,
      )
    },
  })
}
