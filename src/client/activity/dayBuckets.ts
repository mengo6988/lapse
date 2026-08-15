/**
 * Groups already newest-first Activity rows into device-local calendar-day
 * sections (build ticket 21 acceptance criterion: "Entries are day-bucketed
 * in device-local time"). Reuses src/client/domain/daysAgo.ts's
 * local-midnight day-diff math for both the section key and its label —
 * that's the same rule an Entry at 23:30 local on the 3rd already follows
 * elsewhere in the app ("belongs to the 3rd", per the ticket's own example)
 * — rather than re-deriving day-boundary arithmetic a second time here.
 *
 * Rows must already be sorted `occurredAt` desc (the server's contract —
 * see entriesApi.ts) for this single linear pass to only ever open one
 * section per day; it does not re-sort.
 */
import { daysAgo } from '../domain/daysAgo'
import type { ActivityRow } from './activityRows'

export interface DaySection {
  readonly dayKey: string
  readonly label: string
  readonly rows: readonly ActivityRow[]
}

function localDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Lowercase per docs/design.md § Copy tone ("all-lowercase UI strings").
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function dayLabel(occurredAt: string, now: Date): string {
  const diff = daysAgo(occurredAt, now) ?? 0
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'

  const date = new Date(occurredAt)
  const format = date.getFullYear() === now.getFullYear() ? SHORT_DATE : SHORT_DATE_WITH_YEAR
  return format.format(date).toLowerCase()
}

export function groupActivityRowsByDay(rows: readonly ActivityRow[], now: Date): DaySection[] {
  return rows.reduce<DaySection[]>((sections, row) => {
    const dayKey = localDayKey(new Date(row.occurredAt))
    const current = sections[sections.length - 1]

    if (current && current.dayKey === dayKey) {
      return [...sections.slice(0, -1), { ...current, rows: [...current.rows, row] }]
    }

    return [...sections, { dayKey, label: dayLabel(row.occurredAt, now), rows: [row] }]
  }, [])
}
