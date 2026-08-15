/** POST /trackers/:id/variants — adding a row to an existing Tracker in the edit flow. */
import { addVariant, type VariantMutationResponse } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface AddVariantInput {
  trackerId: string
  name: string
  thresholdDays?: number | null
}

export function useAddVariant() {
  return useBootstrapWrite<AddVariantInput, VariantMutationResponse>({
    route: (input) => `/api/trackers/${input.trackerId}/variants`,
    method: 'POST',
    body: ({ trackerId, ...body }) => body,
    onSuccess: { kind: 'graft', graft: (payload, response) => addVariant(payload, response.trackerId, response) },
  })
}
