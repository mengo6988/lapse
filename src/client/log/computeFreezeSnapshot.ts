/**
 * Snapshots the row order/membership home and list are showing right now,
 * before a tap's optimistic update lands — this is what stays frozen for
 * the 5s undo window (build ticket 12: "row order is frozen for the
 * duration of the undo window"). Composes the same selectors ticket 10/11
 * already ship and already carry coverage for, so freezing never
 * re-implements urgency or sorting (docs/tech-stack.md's "reuse, don't
 * reimplement" rule for src/client/domain also applies one level up, to
 * these home/list selectors).
 *
 * Called with the pre-tap Trackers, so a row that's about to become fresh is
 * still captured as overdue/due-soon here — exactly the membership that
 * should stay pinned in its slot for the window (src/client/log/
 * applyFrozenOrder.ts then looks up each frozen id's *live*, post-tap row
 * for display).
 */
import type { Tracker } from '../api'
import { buildHomeRows } from '../home/homeRows'
import { selectQuickLogRows } from '../home/selectQuickLogRows'
import { selectSlippingRows } from '../home/selectSlippingRows'
import { buildListRows } from '../list/buildListRows'

export interface FreezeSnapshot {
  readonly slippingIds: readonly string[]
  readonly quickLogIds: readonly string[]
  readonly listOrder: readonly string[]
}

export function computeFreezeSnapshot(trackers: readonly Tracker[], now: Date): FreezeSnapshot {
  const homeRows = buildHomeRows(trackers)
  const slippingRows = selectSlippingRows(homeRows, now)
  const slippingIds = new Set(slippingRows.map((row) => row.id))
  const quickLogRows = selectQuickLogRows(homeRows, slippingIds, now)
  const listRows = buildListRows(trackers, now)

  return {
    slippingIds: slippingRows.map((row) => row.id),
    quickLogIds: quickLogRows.map((row) => row.id),
    listOrder: listRows.map((row) => row.key),
  }
}
