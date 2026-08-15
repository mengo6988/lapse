import { sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import type { Db } from './db.js'
import { categories } from './schema.js'

/**
 * The starter Categories from docs/spec.md § Categories, seeded on first run
 * only. Colors come from the committed mocha palette (docs/design.md).
 */
const STARTER_CATEGORIES = [
  { name: 'house', color: '#89b4fa' },
  { name: 'car', color: '#f9e2af' },
  { name: 'health', color: '#a6e3a1' },
  { name: 'personal', color: '#cba6f7' },
] as const

export function seedCategories(db: Db): void {
  const [existing] = db.select({ count: sql<number>`count(*)` }).from(categories).all()
  if ((existing?.count ?? 0) > 0) return

  const createdAt = new Date().toISOString()
  db.insert(categories)
    .values(STARTER_CATEGORIES.map((category) => ({ id: uuidv7(), ...category, createdAt })))
    .run()
}
