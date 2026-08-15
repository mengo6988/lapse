/**
 * `GET /trackers/:id/entries` (docs/spec.md § API: "history, cursor-paginated:
 * ?cursor=<entryId>&limit=50, occurredAt desc"). Goes through the shared
 * `apiFetch` (src/client/api/client.ts is the only fetch path in the
 * client) but is not part of src/client/api/**, which this ticket doesn't
 * own — `entrySchema` isn't exported from api/types.ts, so it's redefined
 * here to parse this endpoint's wire shape at the boundary.
 *
 * `HISTORY_PAGE_LIMIT` (20) is smaller than the server's own default (50)
 * — tuned for the infinite-scroll increment on a rarely-visited screen
 * (docs/design.md: "Detail/edit screens are rare visits") rather than the
 * server's default page size.
 */
import { z } from 'zod'
import type { Entry } from '../api'
import { apiFetch } from '../api/client'

const entrySchema: z.ZodType<Entry> = z.object({
  id: z.string(),
  trackerId: z.string(),
  variantId: z.string().nullable(),
  occurredAt: z.string(),
  durationMinutes: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

const historyPageSchema = z.object({
  entries: z.array(entrySchema),
  nextCursor: z.string().nullable(),
})

export type HistoryPage = z.infer<typeof historyPageSchema>

export const HISTORY_PAGE_LIMIT = 20

export async function fetchTrackerEntries(trackerId: string, cursor: string | null): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: String(HISTORY_PAGE_LIMIT) })
  if (cursor) params.set('cursor', cursor)

  const raw = await apiFetch(`/api/trackers/${trackerId}/entries?${params.toString()}`)
  return historyPageSchema.parse(raw)
}
