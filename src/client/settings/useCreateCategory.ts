/**
 * POST /categories (docs/spec.md § API; § Categories: "User can add"). On
 * success the new Category is appended straight to the bootstrap cache
 * (src/client/query/bootstrapCache.ts) so Settings and home/list see it
 * without a refetch.
 */
import type { Category } from '../api'
import { addCategory } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export interface CreateCategoryInput {
  name: string
  color: string
}

export function useCreateCategory() {
  return useBootstrapWrite<CreateCategoryInput, Category>({
    route: '/api/categories',
    method: 'POST',
    onSuccess: { kind: 'graft', graft: addCategory },
  })
}
