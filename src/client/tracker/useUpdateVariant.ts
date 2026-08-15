/**
 * PATCH /variants/:id — rename a Variant, or set/clear its per-Variant
 * Threshold override. `thresholdDays: null` means inherit the parent
 * (docs/spec.md § Domain rules).
 */
import { patchVariant, type VariantMutationResponse } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface UpdateVariantInput {
  variantId: string
  name?: string
  thresholdDays?: number | null
}

export function useUpdateVariant() {
  return useBootstrapWrite<UpdateVariantInput, VariantMutationResponse>({
    route: (input) => `/api/variants/${input.variantId}`,
    method: 'PATCH',
    body: ({ variantId, ...patch }) => patch,
    onSuccess: { kind: 'graft', graft: (payload, response) => patchVariant(payload, response.trackerId, response) },
  })
}
