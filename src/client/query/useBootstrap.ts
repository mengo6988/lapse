/**
 * The launch-time hook that hydrates the query cache (docs/spec.md § API,
 * "Bootstrap payload"). Other tickets read Trackers/Categories through this
 * hook rather than calling fetchBootstrap directly, so there is exactly one
 * shared cache entry to persist and restore.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchBootstrap } from '../api'

export const bootstrapQueryKey = ['bootstrap'] as const

export function useBootstrapQuery() {
  return useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: fetchBootstrap,
  })
}
