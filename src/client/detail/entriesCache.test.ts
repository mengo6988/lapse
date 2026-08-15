import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { Entry } from '../api'
import type { HistoryPage } from './entriesApi'
import { removeEntryFromPages, replaceEntryInPages } from './entriesCache'

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e1',
    trackerId: 't1',
    variantId: null,
    occurredAt: '2026-08-15T00:00:00.000Z',
    durationMinutes: null,
    note: null,
    createdAt: '',
    ...overrides,
  }
}

function data(pages: HistoryPage[]): InfiniteData<HistoryPage> {
  return { pages, pageParams: pages.map(() => null) }
}

describe('replaceEntryInPages', () => {
  it('replaces the matching Entry wherever it is, across pages', () => {
    const before = data([
      { entries: [entry({ id: 'a' }), entry({ id: 'b', note: 'old' })], nextCursor: 'b' },
      { entries: [entry({ id: 'c' })], nextCursor: null },
    ])

    const after = replaceEntryInPages(before, entry({ id: 'b', note: 'new' }))

    expect(after?.pages[0]?.entries.map((e) => e.note)).toEqual([null, 'new'])
    expect(after?.pages[1]?.entries[0]?.id).toBe('c')
  })

  it('does not mutate the original data', () => {
    const before = data([{ entries: [entry({ id: 'a' })], nextCursor: null }])
    const originalEntries = before.pages[0]?.entries
    replaceEntryInPages(before, entry({ id: 'a', note: 'changed' }))
    expect(before.pages[0]?.entries).toBe(originalEntries)
    expect(before.pages[0]?.entries[0]?.note).toBeNull()
  })

  it('is a no-op when there is no cached data yet', () => {
    expect(replaceEntryInPages(undefined, entry({ id: 'a' }))).toBeUndefined()
  })
})

describe('removeEntryFromPages', () => {
  it('drops the matching Entry from whichever page holds it', () => {
    const before = data([
      { entries: [entry({ id: 'a' }), entry({ id: 'b' })], nextCursor: null },
    ])

    const after = removeEntryFromPages(before, 'a')

    expect(after?.pages[0]?.entries.map((e) => e.id)).toEqual(['b'])
  })

  it('is a no-op when there is no cached data yet', () => {
    expect(removeEntryFromPages(undefined, 'a')).toBeUndefined()
  })
})
