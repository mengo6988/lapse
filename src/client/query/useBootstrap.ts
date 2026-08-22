/**
 * The launch-time hook that hydrates the query cache (docs/spec.md § API,
 * "Bootstrap payload"). Other tickets read Trackers/Categories through this
 * hook rather than calling fetchBootstrap directly, so there is exactly one
 * shared cache entry to persist and restore.
 *
 * What it hands back is the fetched payload with the offline queue laid over
 * the top (src/client/outbox/rehydrate.ts) — docs/tech-stack.md § Outbox's
 * rehydration overlay. Every read of Trackers in the app comes through here,
 * so this is the one place that has to know about it; the raw cache entry is
 * left alone, which is what `useLogRow` and the mutation hooks want when they
 * write to it via `queryClient`.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBootstrap } from '../api'
import { useOutboxItems } from '../outbox/outboxStore'
import { applyPendingEntries } from '../outbox/rehydrate'

export const bootstrapQueryKey = ['bootstrap'] as const

export function useBootstrapQuery() {
  const query = useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: fetchBootstrap,
  })
  const queued = useOutboxItems()

  const data = useMemo(
    () => (query.data ? applyPendingEntries(query.data, queued) : query.data),
    [query.data, queued],
  )

  return { ...query, data }
}
