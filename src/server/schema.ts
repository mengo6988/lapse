import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Data model per docs/spec.md § Data model. UUIDv7 text primary keys
 * everywhere (clients generate ids for outbox replay); timestamps are UTC
 * ISO-8601 text with milliseconds.
 */

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
})

export const trackers = sqliteTable(
  'trackers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // Deleting a Category leaves its Trackers uncategorised.
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    thresholdDays: integer('threshold_days'),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('trackers_category_id_idx').on(table.categoryId)],
)

export const variants = sqliteTable(
  'variants',
  {
    id: text('id').primaryKey(),
    trackerId: text('tracker_id')
      .notNull()
      .references(() => trackers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // null inherits the parent Tracker's threshold.
    thresholdDays: integer('threshold_days'),
    // Variant delete is a soft delete: Entries keep their variantId so history
    // keeps its label.
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('variants_tracker_id_idx').on(table.trackerId)],
)

export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    trackerId: text('tracker_id')
      .notNull()
      .references(() => trackers.id, { onDelete: 'cascade' }),
    // No cascade: Variants are only ever soft-deleted, and a hard Tracker
    // delete already takes its Entries.
    variantId: text('variant_id').references(() => variants.id),
    occurredAt: text('occurred_at').notNull(),
    durationMinutes: integer('duration_minutes'),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('entries_tracker_id_occurred_at_idx').on(table.trackerId, table.occurredAt),
    index('entries_variant_id_idx').on(table.variantId),
  ],
)

export type Category = typeof categories.$inferSelect
export type Tracker = typeof trackers.$inferSelect
export type Variant = typeof variants.$inferSelect
export type Entry = typeof entries.$inferSelect
