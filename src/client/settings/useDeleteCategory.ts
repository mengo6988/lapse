/**
 * DELETE /categories/:id (docs/spec.md § Categories: "Deleting a Category
 * leaves its Trackers uncategorised"). The server enforces that via schema
 * (`on delete set null`, src/server/routes/categories.ts); the client cache
 * mirrors it in src/client/query/bootstrapCache.ts's `removeCategory`, which
 * also nulls `categoryId` on every Tracker that pointed at the deleted row —
 * otherwise home/list would keep showing a chip for a Category that no
 * longer exists until the next full bootstrap.
 */
import type { Category } from '../api'
import { removeCategory } from '../query/bootstrapCache'
import { useBootstrapWrite } from '../query/useBootstrapWrite'

export function useDeleteCategory() {
  return useBootstrapWrite<string, Category>({
    route: (categoryId) => `/api/categories/${categoryId}`,
    method: 'DELETE',
    onSuccess: { kind: 'graft', graft: (payload, _response, categoryId) => removeCategory(payload, categoryId) },
  })
}
