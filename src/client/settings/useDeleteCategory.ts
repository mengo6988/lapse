/**
 * DELETE /categories/:id (docs/spec.md § Categories: "Deleting a Category
 * leaves its Trackers uncategorised"). The server enforces that via schema
 * (`on delete set null`, src/server/routes/categories.ts) but the client
 * cache doesn't get that for free — src/client/query/bootstrapCache.ts's
 * `removeCategory` mirrors it by nulling `categoryId` on every Tracker that
 * pointed at the deleted row, otherwise home/list would keep showing a chip
 * for a Category that no longer exists until the next full bootstrap.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { removeCategory } from '../query/bootstrapCache'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { mutationFetch } from '../tracker/mutationClient'

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (categoryId: string) => mutationFetch(`/api/categories/${categoryId}`, { method: 'DELETE' }),
    onSuccess: (_response, categoryId) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) => (old ? removeCategory(old, categoryId) : old))
    },
  })
}
