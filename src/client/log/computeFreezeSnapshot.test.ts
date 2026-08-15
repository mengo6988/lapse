import { describe, expect, it } from 'vitest'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from '../home/fixtures'
import { computeFreezeSnapshot } from './computeFreezeSnapshot'

const NOW = new Date('2026-08-15T12:00:00.000Z')

describe('computeFreezeSnapshot', () => {
  it('captures the current slipping (overdue/due-soon), quick-log, and full list order', () => {
    const overdue = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74, NOW) }),
    })
    const fresh = makeTracker({
      name: 'water plants',
      thresholdDays: 3,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(1, NOW) }),
    })

    const snapshot = computeFreezeSnapshot([overdue, fresh], NOW)

    expect(snapshot.slippingIds).toEqual([overdue.id])
    expect(snapshot.quickLogIds).toEqual([fresh.id])
    expect(snapshot.listOrder).toEqual([overdue.id, fresh.id])
  })

  it('matches the same ids selectSlippingRows/selectQuickLogRows/buildListRows would compute — it never re-implements sorting', () => {
    const volvo = makeVariant({ name: 'volvo', latestEntry: makeEntry({ occurredAt: isoDaysAgo(2, NOW) }) })
    const tyres = makeTracker({ name: 'tyre pressure', thresholdDays: 30, variants: [volvo] })
    const neverLogged = makeTracker({ name: 'descale', thresholdDays: 90 })

    const snapshot = computeFreezeSnapshot([tyres, neverLogged], NOW)

    // neverLogged sorts to the very top per docs/spec.md § Sorting (thresholded, never-logged),
    // so it belongs in listOrder but never in slipping (which is overdue/due-soon only) —
    // volvo (2/30 days, well under the 0.8 due-soon ratio) is fresh, so quick-log instead.
    expect(snapshot.listOrder).toEqual([neverLogged.id, volvo.id])
    expect(snapshot.slippingIds).toEqual([])
    // neither is excluded from quick-log (only slipping ids are excluded) — volvo (logged)
    // ranks ahead of neverLogged, which selectQuickLogRows always sorts last.
    expect(snapshot.quickLogIds).toEqual([volvo.id, neverLogged.id])
  })

  it('excludes slipping rows from quick-log, exactly as selectQuickLogRows does live', () => {
    const overdue = makeTracker({
      name: 'change hvac filter',
      thresholdDays: 60,
      latestEntry: makeEntry({ occurredAt: isoDaysAgo(74, NOW) }),
    })

    const snapshot = computeFreezeSnapshot([overdue], NOW)

    expect(snapshot.slippingIds).toEqual([overdue.id])
    expect(snapshot.quickLogIds).toEqual([])
  })

  it('is empty across the board for no trackers', () => {
    const snapshot = computeFreezeSnapshot([], NOW)
    expect(snapshot).toEqual({ slippingIds: [], quickLogIds: [], listOrder: [] })
  })
})
