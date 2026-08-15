import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.js'

export type Db = ReturnType<typeof drizzle<typeof schema>>

export const MIGRATIONS_FOLDER = 'drizzle'

/**
 * Boot steps 2 and 3 per docs/tech-stack.md § Boot sequence. Pragmas first,
 * then migrations with foreign keys off, then a foreign_key_check that must
 * come back empty — the caller exits 1 rather than serving a partial schema.
 */
export function openDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true })
  const sqlite = new Database(join(dataDir, 'lapse.db'))

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })
  runMigrations(db)
  return db
}

export function runMigrations(db: Db): void {
  const sqlite = db.$client
  sqlite.pragma('foreign_keys = OFF')
  try {
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }

  const violations = sqlite.pragma('foreign_key_check') as unknown[]
  if (violations.length > 0) {
    throw new Error(`migration left ${violations.length} foreign key violation(s)`)
  }
}
