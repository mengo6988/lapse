/**
 * DELETE /variants/:id — soft delete (docs/spec.md § Deletes: entries keep
 * their variantId so history keeps its label; no undelete UI in v1). The
 * response is empty (204), so the cache update needs the tracker/variant id
 * pair the caller already had rather than anything read off the response.
 */
import { removeVariant } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface RemoveVariantInput {
  trackerId: string
  variantId: string
}

export function useRemoveVariant() {
  return useBootstrapWrite<RemoveVariantInput, null>({
    route: (input) => `/api/variants/${input.variantId}`,
    method: 'DELETE',
    onSuccess: {
      kind: 'graft',
      graft: (payload, _response, input) => removeVariant(payload, input.trackerId, input.variantId),
    },
  })
}
