import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { type Db, runMigrations } from './db.js'
import * as schema from './schema.js'
import { seedCategories } from './seed.js'

/**
 * A fresh in-memory database with migrations applied — one per test file, per
 * docs/tech-stack.md § Testing. Seeding is opt-in so seed behavior itself can
 * be tested.
 */
export function createTestDb({ seed = false }: { seed?: boolean } = {}): Db {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  runMigrations(db)
  if (seed) seedCategories(db)
  return db
}
