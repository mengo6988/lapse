/**
 * The bot's read model: every loggable row, and how a line of chat text finds
 * one.
 *
 * A row here is the same thing a row on the List screen is (docs/spec.md §
 * Domain rules): a Tracker with no Variants is one row; a Tracker with
 * Variants contributes one row per Variant and none of its own. Naming them
 * the way the app labels them ("tyre pressure · volvo") is what lets the user
 * type — or tap — the same words they already read on screen.
 *
 * Kept separate from bot.ts so the matching rules, which are the only part
 * with interesting behaviour, are testable without a network in sight.
 */
import { asc, isNull } from 'drizzle-orm'
import type { Db } from '../db.js'
import { entries, trackers, variants } from '../schema.js'

export interface LoggableRow {
  readonly trackerId: string
  readonly variantId: string | null
  /** what the app shows: "vacuuming", or "tyre pressure · volvo". */
  readonly label: string
  readonly thresholdDays: number | null
  readonly lastEntryAt: string | null
}

/** archived Trackers are hidden everywhere in the UI; the bot hides them too. */
export function loggableRows(db: Db): LoggableRow[] {
  const trackerRows = db
    .select()
    .from(trackers)
    .where(isNull(trackers.archivedAt))
    .orderBy(asc(trackers.createdAt))
    .all()
  const variantRows = db.select().from(variants).where(isNull(variants.deletedAt)).all()
  const entryRows = db.select().from(entries).all()

  const latestFor = (trackerId: string, variantId: string | null): string | null =>
    entryRows.reduce<string | null>((latest, entry) => {
      if (entry.trackerId !== trackerId || entry.variantId !== variantId) return latest
      return latest === null || entry.occurredAt > latest ? entry.occurredAt : latest
    }, null)

  return trackerRows.flatMap((tracker): LoggableRow[] => {
    const own = variantRows.filter((variant) => variant.trackerId === tracker.id)

    if (own.length === 0) {
      return [
        {
          trackerId: tracker.id,
          variantId: null,
          label: tracker.name,
          thresholdDays: tracker.thresholdDays,
          lastEntryAt: latestFor(tracker.id, null),
        },
      ]
    }

    return own.map((variant) => ({
      trackerId: tracker.id,
      variantId: variant.id,
      label: `${tracker.name} · ${variant.name}`,
      // null on a Variant inherits the parent's (docs/spec.md § Domain rules).
      thresholdDays: variant.thresholdDays ?? tracker.thresholdDays,
      lastEntryAt: latestFor(tracker.id, variant.id),
    }))
  })
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export type RowMatch =
  | { readonly kind: 'one'; readonly row: LoggableRow }
  | { readonly kind: 'none' }
  | { readonly kind: 'many'; readonly rows: readonly LoggableRow[] }

/**
 * Finds the row a message means, widening only when a narrower rule found
 * nothing: exact label, then the Tracker's name alone, then prefix, then
 * substring.
 *
 * Narrower-first is what keeps a Tracker called "run" reachable when a
 * "running shoes" also exists — substring-only matching would call that
 * ambiguous forever and there would be no way to type your way out of it.
 * Ambiguity is reported rather than guessed at: silently logging the wrong
 * row is worse than one extra message, because the wrong row's "last done"
 * is now a lie the user has no reason to go looking for.
 */
export function matchRow(rows: readonly LoggableRow[], text: string): RowMatch {
  const query = normalise(text)
  if (query === '') return { kind: 'none' }

  const rules: ((row: LoggableRow) => boolean)[] = [
    (row) => normalise(row.label) === query,
    (row) => normalise(row.label.split(' · ')[0] ?? '') === query,
    (row) => normalise(row.label).startsWith(query),
    (row) => normalise(row.label).includes(query),
  ]

  for (const rule of rules) {
    const hits = rows.filter(rule)
    if (hits.length === 1) return { kind: 'one', row: hits[0]! }
    if (hits.length > 1) return { kind: 'many', rows: hits }
  }

  return { kind: 'none' }
}

const MS_PER_DAY = 86_400_000

/** whole days since `lastEntryAt`, or null when nothing is logged. */
export function daysSince(lastEntryAt: string | null, now: Date): number | null {
  if (lastEntryAt === null) return null
  return Math.max(0, Math.floor((now.getTime() - new Date(lastEntryAt).getTime()) / MS_PER_DAY))
}

/**
 * Rows past or nearing their threshold, most overdue first — the same ratio
 * ranking the home list uses (docs/spec.md § Sorting), so /status and the app
 * agree about what is slipping.
 */
export function slippingRows(rows: readonly LoggableRow[], now: Date): LoggableRow[] {
  return rows
    .filter((row) => ratio(row, now) !== null && ratio(row, now)! >= 0.8)
    .sort((a, b) => ratio(b, now)! - ratio(a, now)!)
}

function ratio(row: LoggableRow, now: Date): number | null {
  if (row.thresholdDays === null || row.lastEntryAt === null) return null
  const elapsedDays = (now.getTime() - new Date(row.lastEntryAt).getTime()) / MS_PER_DAY
  return Math.max(0, elapsedDays) / row.thresholdDays
}
