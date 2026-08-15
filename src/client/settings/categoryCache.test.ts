import { describe, expect, it } from 'vitest'
import type { BootstrapPayload } from '../api'
import { addCategoryToCache, patchCategoryInCache, removeCategoryFromCache } from './categoryCache'

function basePayload(): BootstrapPayload {
  return {
    categories: [
      { id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'car', name: 'car', color: '#fab387', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    trackers: [
      {
        id: 't1',
        name: 'water the plants',
        categoryId: 'house',
        thresholdDays: null,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: null,
        variants: [],
      },
      {
        id: 't2',
        name: 'rotate tyres',
        categoryId: 'car',
        thresholdDays: null,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: null,
        variants: [],
      },
      {
        id: 't3',
        name: 'no category',
        categoryId: null,
        thresholdDays: null,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: null,
        variants: [],
      },
    ],
  }
}

describe('addCategoryToCache', () => {
  it('appends the new Category', () => {
    const payload = basePayload()

    const next = addCategoryToCache(payload, { id: 'health', name: 'health', color: '#f38ba8', createdAt: '2026-08-15T00:00:00.000Z' })

    expect(next.categories.map((c) => c.id)).toEqual(['house', 'car', 'health'])
  })

  it('does not mutate the original payload', () => {
    const payload = basePayload()
    const original = JSON.parse(JSON.stringify(payload))

    addCategoryToCache(payload, { id: 'health', name: 'health', color: '#f38ba8', createdAt: '' })

    expect(payload).toEqual(original)
  })
})

describe('patchCategoryInCache', () => {
  it('replaces the renamed/recolored Category in place', () => {
    const payload = basePayload()

    const next = patchCategoryInCache(payload, { id: 'house', name: 'home', color: '#ffffff', createdAt: '2026-01-01T00:00:00.000Z' })

    const category = next.categories.find((c) => c.id === 'house')!
    expect(category.name).toBe('home')
    expect(category.color).toBe('#ffffff')
    // untouched sibling
    expect(next.categories.find((c) => c.id === 'car')?.name).toBe('car')
  })

  it('does not mutate the original payload', () => {
    const payload = basePayload()
    const original = JSON.parse(JSON.stringify(payload))

    patchCategoryInCache(payload, { id: 'house', name: 'home', color: '#ffffff', createdAt: '' })

    expect(payload).toEqual(original)
  })
})

describe('removeCategoryFromCache', () => {
  it('drops the Category from the categories list', () => {
    const payload = basePayload()

    const next = removeCategoryFromCache(payload, 'house')

    expect(next.categories.map((c) => c.id)).toEqual(['car'])
  })

  it('nulls categoryId on every Tracker that referenced the deleted Category, mirroring on-delete-set-null', () => {
    const payload = basePayload()

    const next = removeCategoryFromCache(payload, 'house')

    expect(next.trackers.find((t) => t.id === 't1')?.categoryId).toBeNull()
    // untouched: different category, and already uncategorised
    expect(next.trackers.find((t) => t.id === 't2')?.categoryId).toBe('car')
    expect(next.trackers.find((t) => t.id === 't3')?.categoryId).toBeNull()
  })

  it('does not mutate the original payload', () => {
    const payload = basePayload()
    const original = JSON.parse(JSON.stringify(payload))

    removeCategoryFromCache(payload, 'house')

    expect(payload).toEqual(original)
  })

  it('is a no-op on categories/trackers when the id is not present', () => {
    const payload = basePayload()

    const next = removeCategoryFromCache(payload, 'ghost')

    expect(next.categories).toHaveLength(2)
    expect(next.trackers.map((t) => t.categoryId)).toEqual(['house', 'car', null])
  })
})
