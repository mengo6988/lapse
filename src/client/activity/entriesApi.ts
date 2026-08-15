/**
 * `GET /entries` (docs/spec.md § API): all Entries across every Tracker,
 * `occurredAt desc` (`id desc` tiebreak), cursor-paginated on the
 * (occurredAt, id) pair — the cross-Tracker feed
 * src/client/detail/entriesApi.ts's tracker-scoped history endpoint can't
 * produce. Goes through the shared `apiFetch` (src/client/api/client.ts is
 * the only fetch path in the client).
 *
 * `ACTIVITY_PAGE_LIMIT` matches the server's own default (50), unlike
 * detail's smaller 20 — this is a frequently-visited root tab (docs/design.md
 * § Navigation), not detail's "rare visit" screen, so there's no reason to
 * shrink the page below what the server already hands back by default.
 */
import { z } from 'zod'
import { apiFetch } from '../api/client'
import { entrySchema } from '../api/types'

const activityPageSchema = z.object({
  entries: z.array(entrySchema),
  nextCursor: z.string().nullable(),
})

export type ActivityPage = z.infer<typeof activityPageSchema>

export const ACTIVITY_PAGE_LIMIT = 50

export async function fetchActivityEntries(cursor: string | null): Promise<ActivityPage> {
  const params = new URLSearchParams({ limit: String(ACTIVITY_PAGE_LIMIT) })
  if (cursor) params.set('cursor', cursor)

  const raw = await apiFetch(`/api/entries?${params.toString()}`)
  return activityPageSchema.parse(raw)
}
