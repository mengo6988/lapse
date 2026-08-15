/**
 * PATCH /categories/:id — rename and/or recolor in one endpoint
 * (docs/spec.md § Categories).
 */
import type { Category } from '../api'
import { patchCategory } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface UpdateCategoryInput {
  id: string
  name?: string
  color?: string
}

export function useUpdateCategory() {
  return useBootstrapWrite<UpdateCategoryInput, Category>({
    route: (input) => `/api/categories/${input.id}`,
    method: 'PATCH',
    body: ({ id, ...patch }) => patch,
    onSuccess: { kind: 'graft', graft: patchCategory },
  })
}
