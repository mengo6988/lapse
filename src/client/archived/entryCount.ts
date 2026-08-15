/**
 * Total Entry count for a Tracker, for the hard-delete confirmation copy
 * (docs/design.md § Archived/Settings: "confirm names the entry count being
 * destroyed"). No endpoint returns a count directly — the bootstrap payload
 * only carries each row's *latest* Entry (docs/spec.md § API) — and this
 * ticket's file fence only allows adding a server endpoint if the hard-delete
 * endpoint itself were missing; `DELETE /trackers/:id` already exists
 * (src/server/routes/trackers.ts), so no server change is in scope here.
 *
 * The cheapest correct option without a new endpoint: `GET
 * /trackers/:id/entries` already returns every Entry belonging to the
 * Tracker — variant-level and variantless alike, since `entries.trackerId`
 * is always set (src/server/schema.ts) — so this walks it at the server's
 * largest allowed page size (100, src/server/routes/entries.ts) and sums
 * page lengths. For the single-user, personal-scale data this app targets
 * that's one request for most Trackers; it is only ever called on demand,
 * when the delete dialog opens for one specific Tracker, never eagerly for
 * the whole archived list.
 */
import { apiFetch } from '../api/client'

const PAGE_LIMIT = 100

interface EntryPage {
  entries: readonly unknown[]
  nextCursor: string | null
}

function isEntryPage(value: unknown): value is EntryPage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { entries?: unknown; nextCursor?: unknown }
  return Array.isArray(candidate.entries) && (typeof candidate.nextCursor === 'string' || candidate.nextCursor === null)
}

export async function fetchEntryCount(trackerId: string): Promise<number> {
  let total = 0
  let cursor: string | null = null

  for (;;) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
    if (cursor !== null) params.set('cursor', cursor)

    const raw = await apiFetch(`/api/trackers/${trackerId}/entries?${params.toString()}`)
    if (!isEntryPage(raw)) throw new Error('unexpected /entries response shape')

    total += raw.entries.length
    if (raw.nextCursor === null) return total
    // a cursor that doesn't advance would spin this loop forever and hang the
    // dialog; a page that came back empty can't advance it either.
    if (raw.nextCursor === cursor || raw.entries.length === 0) {
      throw new Error('/entries cursor did not advance')
    }
    cursor = raw.nextCursor
  }
}
