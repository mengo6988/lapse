import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, lt, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import { entries, trackers, variants } from '../schema.js'
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
 * A future occurredAt degrades to an editable server-now instead of being
 * rejected, per docs/spec.md § Validation (a skewed client clock must never
 * dead-letter a log).
 */
function clampFutureOccurredAt(occurredAt: string | undefined, nowIso: string): string {
  if (!occurredAt) return nowIso
  return new Date(occurredAt).getTime() > new Date(nowIso).getTime() ? nowIso : occurredAt
}

/**
 * Entry and history routes. Paths are declared relative to the `/api` mount in
 * app.ts (so `/entries`, `/trackers/:id/entries`, ...).
 */
export function entryRoutes({ db }: RouteDeps) {
  const app = new Hono()

  app.post('/entries', zValidator('json', createEntrySchema), (c) => {
    const body = c.req.valid('json')

    // Idempotency (docs/spec.md § Idempotency): a replayed outbox id returns
    // the existing row untouched, before any other validation runs.
    if (body.id) {
      const existing = db.select().from(entries).where(eq(entries.id, body.id)).get()
      if (existing) return c.json(existing, 200)
    }

    const tracker = db.select().from(trackers).where(eq(trackers.id, body.trackerId)).get()
    if (!tracker) return c.json({ error: 'tracker not found' }, 404)

    if (body.variantId) {
      const variant = db.select().from(variants).where(eq(variants.id, body.variantId)).get()
      if (!variant || variant.trackerId !== body.trackerId) {
        return c.json({ error: 'variant does not belong to tracker' }, 400)
      }
    }

    const nowIso = new Date().toISOString()
    const entry = {
      id: body.id ?? uuidv7(),
      trackerId: body.trackerId,
      variantId: body.variantId ?? null,
      occurredAt: clampFutureOccurredAt(body.occurredAt, nowIso),
      durationMinutes: body.durationMinutes ?? null,
      note: body.note ?? null,
      createdAt: nowIso,
    }

    db.insert(entries).values(entry).run()
    return c.json(entry, 201)
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

  return app
}
