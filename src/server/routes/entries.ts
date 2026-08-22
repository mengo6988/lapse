import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, isNotNull, lt, notInArray, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { clampFutureOccurredAt, createEntry } from '../entryWrites.js'
import { entries, trackers } from '../schema.js'
import type { RouteDeps } from './deps.js'

const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 100

const createEntrySchema = z.object({
  id: z.string().min(1).optional(),
  trackerId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

const updateEntrySchema = z.object({
  occurredAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

const historyQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
})

/**
 * Entry and history routes. Paths are declared relative to the `/api` mount in
 * app.ts (so `/entries`, `/trackers/:id/entries`, ...).
 */
export function entryRoutes({ db }: RouteDeps) {
  const app = new Hono()

  // The write itself lives in src/server/entryWrites.ts, shared with the
  // Telegram bot — this handler is the HTTP shape around it. A replayed id
  // comes back 200 rather than 201, which is what makes an outbox replay safe.
  app.post('/entries', zValidator('json', createEntrySchema), (c) => {
    const result = createEntry(db, c.req.valid('json'))
    if (!result.ok) return c.json({ error: result.error }, result.status)
    return c.json(result.entry, result.created ? 201 : 200)
  })

  app.patch('/entries/:id', zValidator('json', updateEntrySchema), (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')

    const existing = db.select().from(entries).where(eq(entries.id, id)).get()
    if (!existing) return c.json({ error: 'entry not found' }, 404)

    const nowIso = new Date().toISOString()
    const updates = {
      ...(body.occurredAt !== undefined
        ? { occurredAt: clampFutureOccurredAt(body.occurredAt, nowIso) }
        : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
    }

    if (Object.keys(updates).length === 0) return c.json(existing, 200)

    db.update(entries).set(updates).where(eq(entries.id, id)).run()
    return c.json({ ...existing, ...updates }, 200)
  })

  app.delete('/entries/:id', (c) => {
    const id = c.req.param('id')

    const existing = db.select().from(entries).where(eq(entries.id, id)).get()
    if (!existing) return c.json({ error: 'entry not found' }, 404)

    db.delete(entries).where(eq(entries.id, id)).run()
    return c.body(null, 204)
  })

  app.get('/trackers/:id/entries', zValidator('query', historyQuerySchema), (c) => {
    const trackerId = c.req.param('id')
    const { cursor, limit: requestedLimit } = c.req.valid('query')
    const limit = Math.min(requestedLimit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT)

    const tracker = db.select().from(trackers).where(eq(trackers.id, trackerId)).get()
    if (!tracker) return c.json({ error: 'tracker not found' }, 404)

    const cursorEntry = cursor
      ? db.select().from(entries).where(eq(entries.id, cursor)).get()
      : undefined
    if (cursor && !cursorEntry) return c.json({ error: 'invalid cursor' }, 400)

    // Page on the (occurredAt, id) pair, not occurredAt alone, so the cursor
    // stays stable across rows that share an occurredAt.
    const cursorCondition = cursorEntry
      ? or(
          lt(entries.occurredAt, cursorEntry.occurredAt),
          and(eq(entries.occurredAt, cursorEntry.occurredAt), lt(entries.id, cursorEntry.id)),
        )
      : undefined

    const rows = db
      .select()
      .from(entries)
      .where(and(eq(entries.trackerId, trackerId), cursorCondition))
      .orderBy(desc(entries.occurredAt), desc(entries.id))
      .limit(limit + 1)
      .all()

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null

    return c.json({ entries: page, nextCursor })
  })

  // The cross-Tracker "did I already log that?" feed (docs/design.md §
  // Navigation: "activity = recent Entries feed"; build ticket 21). Same
  // query schema, limit clamping, and (occurredAt, id) cursor contract as
  // `GET /trackers/:id/entries` above — the only difference is no
  // `trackerId` filter, since this spans every Tracker.
  app.get('/entries', zValidator('query', historyQuerySchema), (c) => {
    const { cursor, limit: requestedLimit } = c.req.valid('query')
    const limit = Math.min(requestedLimit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT)

    const cursorEntry = cursor
      ? db.select().from(entries).where(eq(entries.id, cursor)).get()
      : undefined
    if (cursor && !cursorEntry) return c.json({ error: 'invalid cursor' }, 400)

    const cursorCondition = cursorEntry
      ? or(
          lt(entries.occurredAt, cursorEntry.occurredAt),
          and(eq(entries.occurredAt, cursorEntry.occurredAt), lt(entries.id, cursorEntry.id)),
        )
      : undefined

    // Archived Trackers stay hidden everywhere in the UI (docs/spec.md §
    // Idempotency: "the UI hides them regardless"), so this feed filters
    // their Entries out here rather than leaving it to the client —
    // filtering after the fact would under-fill a page (or force the client
    // to guess how much to over-fetch), which would break the `limit + 1`
    // has-more probe below. `notInArray` with an empty id list degrades to
    // "true" (drizzle-orm), so this is a no-op on the common case of zero
    // archived Trackers rather than a special case to guard against.
    const archivedTrackerIds = db
      .select({ id: trackers.id })
      .from(trackers)
      .where(isNotNull(trackers.archivedAt))
      .all()
      .map((row) => row.id)

    const rows = db
      .select()
      .from(entries)
      .where(and(notInArray(entries.trackerId, archivedTrackerIds), cursorCondition))
      .orderBy(desc(entries.occurredAt), desc(entries.id))
      .limit(limit + 1)
      .all()

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null

    return c.json({ entries: page, nextCursor })
  })

  return app
}
