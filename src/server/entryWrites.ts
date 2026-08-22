/**
 * Creating an Entry, with none of the HTTP around it.
 *
 * Two callers now write Entries: `POST /entries` (src/server/routes/
 * entries.ts) and the Telegram bot (src/server/telegram/bot.ts). The rules
 * they have to agree on are the ones that are silent when they drift — the
 * idempotency contract that makes an outbox replay safe (docs/spec.md §
 * Idempotency) and the future-`occurredAt` clamp that keeps a skewed clock
 * from dead-lettering a log (docs/spec.md § Validation). A second
 * hand-written copy of those in the bot would work on the day it was written
 * and quietly stop matching later.
 *
 * Returns a result rather than throwing: every failure here is a 4xx the
 * caller has to phrase for its own audience — a JSON body for the app, a
 * sentence in a chat for the bot.
 */
import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import type { Db } from './db.js'
import type { Entry } from './schema.js'
import { entries, trackers, variants } from './schema.js'

export interface CreateEntryInput {
  /** client-generated UUIDv7 when the caller has one; a replay of it is a no-op. */
  readonly id?: string
  readonly trackerId: string
  readonly variantId?: string
  readonly occurredAt?: string
  readonly durationMinutes?: number | null
  readonly note?: string | null
}

export type CreateEntryResult =
  | { readonly ok: true; readonly entry: Entry; readonly created: boolean }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string }

/**
 * A future occurredAt degrades to an editable server-now instead of being
 * rejected, per docs/spec.md § Validation (a skewed client clock must never
 * dead-letter a log).
 */
export function clampFutureOccurredAt(occurredAt: string | undefined, nowIso: string): string {
  if (!occurredAt) return nowIso
  return new Date(occurredAt).getTime() > new Date(nowIso).getTime() ? nowIso : occurredAt
}

export function createEntry(db: Db, input: CreateEntryInput): CreateEntryResult {
  // Idempotency (docs/spec.md § Idempotency): a replayed outbox id returns
  // the existing row untouched, before any other validation runs.
  if (input.id) {
    const existing = db.select().from(entries).where(eq(entries.id, input.id)).get()
    if (existing) return { ok: true, entry: existing, created: false }
  }

  const tracker = db.select().from(trackers).where(eq(trackers.id, input.trackerId)).get()
  if (!tracker) return { ok: false, status: 404, error: 'tracker not found' }

  if (input.variantId) {
    const variant = db.select().from(variants).where(eq(variants.id, input.variantId)).get()
    if (!variant || variant.trackerId !== input.trackerId) {
      return { ok: false, status: 400, error: 'variant does not belong to tracker' }
    }
  }

  const nowIso = new Date().toISOString()
  const entry: Entry = {
    id: input.id ?? uuidv7(),
    trackerId: input.trackerId,
    variantId: input.variantId ?? null,
    occurredAt: clampFutureOccurredAt(input.occurredAt, nowIso),
    durationMinutes: input.durationMinutes ?? null,
    note: input.note ?? null,
    createdAt: nowIso,
  }

  db.insert(entries).values(entry).run()
  return { ok: true, entry, created: true }
}
