/**
 * PATCH /categories/:id — rename and/or recolor in one endpoint
 * (docs/spec.md § Categories), the same shape as
 * src/client/tracker/useUpdateTracker.ts.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload, Category } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { jsonRequest, mutationFetch } from '../tracker/mutationClient'
import { patchCategoryInCache } from './categoryCache'

export interface UpdateCategoryInput {
  id: string
  name?: string
  color?: string
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateCategoryInput) =>
      mutationFetch(`/api/categories/${id}`, jsonRequest('PATCH', patch)) as Promise<Category>,
    onSuccess: (category) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) => (old ? patchCategoryInCache(old, category) : old))
    },
  })
}
