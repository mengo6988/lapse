import { describe, expect, it } from 'vitest'
import type { BootstrapPayload } from '../api'
import type { OutboxItem } from './outboxStore'
import { resolveQueuedLabel } from './queuedLabel'

function tracker(overrides: Partial<BootstrapPayload['trackers'][number]> = {}): BootstrapPayload['trackers'][number] {
  return {
    id: 'tracker-1',
    name: 'water the plants',
    categoryId: null,
    thresholdDays: null,
    archivedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

function payload(trackers: BootstrapPayload['trackers']): BootstrapPayload {
  return { categories: [], trackers }
}

function createItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'entry-1',
    kind: 'create',
    input: {
      id: 'entry-1',
      trackerId: 'tracker-1',
      variantId: null,
      occurredAt: '2026-08-15T10:30:00.000Z',
    },
    attempts: 0,
    status: 'pending',
    queuedAt: '2026-08-15T10:30:05.000Z',
    ...overrides,
  }
}

describe('resolveQueuedLabel', () => {
  it('resolves the Tracker name for a tracker-level create item', () => {
    const label = resolveQueuedLabel(createItem(), payload([tracker()]))
    expect(label.name).toBe('water the plants')
  })

  it('appends the Variant name with a " · " suffix when the item targets a Variant', () => {
    const item = createItem({
      input: { id: 'entry-1', trackerId: 'tracker-1', variantId: 'variant-1', occurredAt: '2026-08-15T10:30:00.000Z' },
    })
    const bootstrap = payload([tracker({ variants: [{ id: 'variant-1', name: 'basil', thresholdDays: null, latestEntry: null }] })])

    const label = resolveQueuedLabel(item, bootstrap)
    expect(label.name).toBe('water the plants · basil')
  })

  it('falls back honestly when the Tracker no longer exists in the bootstrap payload', () => {
    const label = resolveQueuedLabel(createItem(), payload([]))
    expect(label.name).toBe('unknown tracker')
  })

  it('falls back honestly when the Variant no longer exists but the Tracker does', () => {
    const item = createItem({
      input: { id: 'entry-1', trackerId: 'tracker-1', variantId: 'ghost-variant', occurredAt: '2026-08-15T10:30:00.000Z' },
    })
    const label = resolveQueuedLabel(item, payload([tracker()]))
    expect(label.name).toBe('water the plants · unknown variant')
  })

  it('falls back honestly when the bootstrap payload is not yet available', () => {
    const label = resolveQueuedLabel(createItem(), undefined)
    expect(label.name).toBe('unknown tracker')
  })

  it('labels a delete item generically — it carries no Tracker/Variant reference at all', () => {
    const item = createItem({ kind: 'delete', input: null })
    const label = resolveQueuedLabel(item, payload([tracker()]))
    expect(label.name).toBe('removing an entry')
  })

  it('formats the intended time from the create input\'s occurredAt', () => {
    const label = resolveQueuedLabel(createItem(), payload([tracker()]))
    expect(label.time).toBe(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-08-15T10:30:00.000Z')))
  })

  it('falls back to queuedAt for the intended time when there is no input', () => {
    const item = createItem({ kind: 'delete', input: null })
    const label = resolveQueuedLabel(item, payload([tracker()]))
    expect(label.time).toBe(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-08-15T10:30:05.000Z')))
  })
})
