import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import type { RouteDeps } from './deps.js'
import { trackers, variants, type Tracker, type Variant } from '../schema.js'

const nameSchema = z.string().trim().min(1).max(100)
const thresholdDaysSchema = z.number().int().min(1).max(3650)

const variantInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: nameSchema,
  thresholdDays: thresholdDaysSchema.nullable().optional(),
})

const createTrackerSchema = z.object({
  id: z.string().min(1).optional(),
  name: nameSchema,
  categoryId: z.string().min(1).nullable().optional(),
  thresholdDays: thresholdDaysSchema.nullable().optional(),
  variants: z.array(variantInputSchema).optional(),
})

const patchTrackerSchema = z.object({
  name: nameSchema.optional(),
  categoryId: z.string().min(1).nullable().optional(),
  thresholdDays: thresholdDaysSchema.nullable().optional(),
  archived: z.boolean().optional(),
})

const addVariantSchema = z.object({
  id: z.string().min(1).optional(),
  name: nameSchema,
  thresholdDays: thresholdDaysSchema.nullable().optional(),
})

const patchVariantSchema = z.object({
  name: nameSchema.optional(),
  thresholdDays: thresholdDaysSchema.nullable().optional(),
})

type TrackerWithVariants = Tracker & { variants: Variant[] }

// better-sqlite3 throws a SqliteError with this code when the foreign_keys
// pragma (on for every Db in this app) rejects a reference to a missing row.
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
  )
}

/**
 * Tracker and Variant routes. Paths are declared relative to the `/api` mount
 * in app.ts (so `/trackers`, `/variants/:id`, ...).
 */
export function trackerRoutes({ db }: RouteDeps) {
  const app = new Hono()

  const findTracker = (id: string): Tracker | undefined =>
    db.select().from(trackers).where(eq(trackers.id, id)).get()

  // Reads exclude soft-deleted Variants per docs/spec.md § Deletes.
  const findActiveVariant = (id: string): Variant | undefined =>
    db
      .select()
      .from(variants)
      .where(and(eq(variants.id, id), isNull(variants.deletedAt)))
      .get()

  const activeVariantsOf = (trackerId: string): Variant[] =>
    db
      .select()
      .from(variants)
      .where(and(eq(variants.trackerId, trackerId), isNull(variants.deletedAt)))
      .all()

  const withVariants = (tracker: Tracker): TrackerWithVariants => ({
    ...tracker,
    variants: activeVariantsOf(tracker.id),
  })

  app.post('/trackers', zValidator('json', createTrackerSchema), (c) => {
    const body = c.req.valid('json')
    const now = new Date().toISOString()
    const trackerId = body.id ?? uuidv7()

    try {
      db.insert(trackers)
        .values({
          id: trackerId,
          name: body.name,
          categoryId: body.categoryId ?? null,
          thresholdDays: body.thresholdDays ?? null,
          archivedAt: null,
          createdAt: now,
        })
        .run()
    } catch (error) {
      if (isForeignKeyViolation(error)) return c.json({ error: 'invalid categoryId' }, 400)
      throw error
    }

    for (const variant of body.variants ?? []) {
      db.insert(variants)
        .values({
          id: variant.id ?? uuidv7(),
          trackerId,
          name: variant.name,
          thresholdDays: variant.thresholdDays ?? null,
          deletedAt: null,
          createdAt: now,
        })
        .run()
    }

    return c.json(withVariants(findTracker(trackerId)!), 201)
  })

  app.patch('/trackers/:id', zValidator('json', patchTrackerSchema), (c) => {
    const id = c.req.param('id')
    if (!findTracker(id)) return c.json({ error: 'tracker not found' }, 404)

    const body = c.req.valid('json')
    const updates: Partial<Tracker> = {}
    if ('name' in body) updates.name = body.name
    if ('categoryId' in body) updates.categoryId = body.categoryId
    if ('thresholdDays' in body) updates.thresholdDays = body.thresholdDays
    if ('archived' in body) updates.archivedAt = body.archived ? new Date().toISOString() : null

    if (Object.keys(updates).length > 0) {
      try {
        db.update(trackers).set(updates).where(eq(trackers.id, id)).run()
      } catch (error) {
        if (isForeignKeyViolation(error)) return c.json({ error: 'invalid categoryId' }, 400)
        throw error
      }
    }

    return c.json(withVariants(findTracker(id)!), 200)
  })

  app.delete('/trackers/:id', (c) => {
    const id = c.req.param('id')
    const tracker = findTracker(id)
    if (!tracker) return c.json({ error: 'tracker not found' }, 404)
    if (!tracker.archivedAt) {
      return c.json({ error: 'tracker must be archived before it can be deleted' }, 409)
    }

    // Cascades variants + entries via the schema's ON DELETE CASCADE, with
    // foreign_keys enforced on every Db (see db.ts).
    db.delete(trackers).where(eq(trackers.id, id)).run()
    return c.body(null, 204)
  })

  app.post('/trackers/:id/variants', zValidator('json', addVariantSchema), (c) => {
    const trackerId = c.req.param('id')
    if (!findTracker(trackerId)) return c.json({ error: 'tracker not found' }, 404)

    const body = c.req.valid('json')
    const variantId = body.id ?? uuidv7()

    db.insert(variants)
      .values({
        id: variantId,
        trackerId,
        name: body.name,
        thresholdDays: body.thresholdDays ?? null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      })
      .run()

    return c.json(db.select().from(variants).where(eq(variants.id, variantId)).get()!, 201)
  })

  app.patch('/variants/:id', zValidator('json', patchVariantSchema), (c) => {
    const id = c.req.param('id')
    if (!findActiveVariant(id)) return c.json({ error: 'variant not found' }, 404)

    const body = c.req.valid('json')
    const updates: Partial<Variant> = {}
    if ('name' in body) updates.name = body.name
    if ('thresholdDays' in body) updates.thresholdDays = body.thresholdDays

    if (Object.keys(updates).length > 0) {
      db.update(variants).set(updates).where(eq(variants.id, id)).run()
    }

    return c.json(db.select().from(variants).where(eq(variants.id, id)).get()!, 200)
  })

  app.delete('/variants/:id', (c) => {
    const id = c.req.param('id')
    if (!findActiveVariant(id)) return c.json({ error: 'variant not found' }, 404)

    db.update(variants).set({ deletedAt: new Date().toISOString() }).where(eq(variants.id, id)).run()
    return c.body(null, 204)
  })

  return app
}
