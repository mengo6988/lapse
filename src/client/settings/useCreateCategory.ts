/**
 * POST /categories (docs/spec.md § API; § Categories: "User can add"). On
 * success the new Category is appended straight to the bootstrap cache — the
 * same immediate-cache-graft idiom as src/client/tracker/useCreateTracker.ts
 * — and reuses `mutationFetch`/`jsonRequest`/`TrackerApiError` from
 * src/client/tracker/mutationClient.ts rather than a second fetch-plus-
 * field-error-parsing path, matching the precedent
 * src/client/archived/useHardDeleteTracker.ts already set for a
 * non-tracker route.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BootstrapPayload, Category } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { jsonRequest, mutationFetch } from '../tracker/mutationClient'
import { addCategoryToCache } from './categoryCache'

export interface CreateCategoryInput {
  name: string
  color: string
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      mutationFetch('/api/categories', jsonRequest('POST', input)) as Promise<Category>,
    onSuccess: (category) => {
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) => (old ? addCategoryToCache(old, category) : old))
    },
  })
}
