/**
 * POST /entries and DELETE /entries/:id (docs/spec.md § API) on top of the
 * shared `apiFetch`/`jsonRequest` (src/client/api/client.ts is the only
 * fetch path in the client). Deliberately thin: no retry, no queueing — that
 * is ticket 17's outbox. A failure here throws the same `ApiError` apiFetch
 * always throws; the caller (src/client/log/useLogRow.ts) decides what
 * "fail fast" means for the optimistic UI.
 */
import { apiFetch, jsonRequest } from '../api/client'
import type { Entry } from '../api/types'

export interface CreateEntryInput {
  readonly id: string
  readonly trackerId: string
  readonly variantId: string | null
  readonly occurredAt: string
  /** build ticket 13: the log sheet's optional duration/note. Both nullable+optional server-side (src/server/routes/entries.ts), so a null/omitted value here is just left out of the body rather than sent explicitly. */
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

/**
 * The create schema (src/server/routes/entries.ts) treats variantId as
 * `.optional()`, not `.nullable()` — a tracker-level log must omit the key
 * entirely rather than send `variantId: null`. durationMinutes/note are
 * `.nullable().optional()`, so omitting a null value is equally valid and
 * keeps a plain tap's body exactly as small as it was before this ticket.
 */
export async function postEntry(input: CreateEntryInput): Promise<Entry> {
  const body: Record<string, unknown> = {
    id: input.id,
    trackerId: input.trackerId,
    occurredAt: input.occurredAt,
  }
  if (input.variantId !== null) body.variantId = input.variantId
  if (input.durationMinutes != null) body.durationMinutes = input.durationMinutes
  if (input.note != null) body.note = input.note

  return (await apiFetch('/api/entries', jsonRequest('POST', body))) as Entry
}

export async function deleteEntry(id: string): Promise<void> {
  await apiFetch(`/api/entries/${id}`, jsonRequest('DELETE'))
}
