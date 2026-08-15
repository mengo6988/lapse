import { zValidator } from '@hono/zod-validator'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import { categories } from '../schema.js'
import type { RouteDeps } from './deps.js'

const name = z.string().trim().min(1).max(100)
const color = z.string().regex(/^#[0-9a-f]{6}$/, 'expected a lowercase #rrggbb color')

const createCategorySchema = z.object({ name, color })
const updateCategorySchema = z.object({ name: name.optional(), color: color.optional() })

/**
 * Category routes. Paths are declared relative to the `/api` mount in app.ts
 * (so `/categories`, `/categories/:id`).
 *
 * Deleting a Category leaves its Trackers uncategorised via the schema's
 * `categoryId` `on delete set null` — no application-level cleanup needed.
 */
export function categoryRoutes({ db }: RouteDeps) {
  const app = new Hono()

  app.get('/categories', (c) => {
    const rows = db.select().from(categories).orderBy(asc(categories.createdAt)).all()
    return c.json(rows)
  })

  app.post('/categories', zValidator('json', createCategorySchema), (c) => {
    const input = c.req.valid('json')
    const row = { id: uuidv7(), ...input, createdAt: new Date().toISOString() }
    db.insert(categories).values(row).run()
    return c.json(row, 201)
  })

  app.patch('/categories/:id', zValidator('json', updateCategorySchema), (c) => {
    const id = c.req.param('id')
    const input = c.req.valid('json')
    const existing = db.select().from(categories).where(eq(categories.id, id)).get()
    if (!existing) return c.json({ error: 'category not found' }, 404)

    if (Object.keys(input).length > 0) {
      db.update(categories).set(input).where(eq(categories.id, id)).run()
    }
    return c.json({ ...existing, ...input })
  })

  app.delete('/categories/:id', (c) => {
    const id = c.req.param('id')
    const existing = db.select().from(categories).where(eq(categories.id, id)).get()
    if (!existing) return c.json({ error: 'category not found' }, 404)

    db.delete(categories).where(eq(categories.id, id)).run()
    return c.json(existing)
  })

  return app
}
