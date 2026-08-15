/**
 * React Query wrapper around fetchEntryCount, gated by `enabled` so it only
 * runs while the hard-delete dialog for this Tracker is actually open — see
 * entryCount.ts for why this is on-demand rather than eager. `staleTime: 0`
 * because the count backs a destructive confirmation: it must reflect what
 * will actually be destroyed right now, not a value cached from an earlier
 * dialog open for the same Tracker.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchEntryCount } from './entryCount'

export function useEntryCountQuery(trackerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['archived', 'entryCount', trackerId],
    queryFn: () => fetchEntryCount(trackerId),
    enabled,
    staleTime: 0,
  })
}
