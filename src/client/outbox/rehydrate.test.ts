import { describe, expect, it } from 'vitest'
import type { BootstrapPayload, Entry } from '../api'
import type { CreateEntryInput, OutboxItem } from './outboxStore'
import { applyPendingEntries } from './rehydrate'

function entry(id: string, occurredAt: string, variantId: string | null = null): Entry {
  return {
    id,
    trackerId: 't1',
    variantId,
    occurredAt,
    durationMinutes: null,
    note: null,
    createdAt: occurredAt,
  }
}

function payload(latestEntry: Entry | null, variantLatest: Entry | null = null): BootstrapPayload {
  return {
    categories: [],
    trackers: [
      {
        id: 't1',
        name: 'vacuuming',
        categoryId: null,
        thresholdDays: 7,
        archivedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        latestEntry,
        variants: [{ id: 'v1', name: 'upstairs', thresholdDays: null, latestEntry: variantLatest }],
      },
    ],
  }
}

function queuedCreate(overrides: Partial<CreateEntryInput> = {}, item: Partial<OutboxItem> = {}): OutboxItem {
  const input: CreateEntryInput = {
    id: 'queued-1',
    trackerId: 't1',
    variantId: null,
    occurredAt: '2026-08-20T09:00:00.000Z',
    ...overrides,
  }
  return {
    id: input.id,
    kind: 'create',
    input,
    attempts: 0,
    status: 'pending',
    queuedAt: '2026-08-20T09:00:01.000Z',
    ...item,
  }
}

describe('applyPendingEntries', () => {
  it('lays a queued log over a server payload that has never seen it', () => {
    const result = applyPendingEntries(payload(entry('old', '2026-08-01T00:00:00.000Z')), [queuedCreate()])

    expect(result.trackers[0]?.latestEntry).toEqual({
      id: 'queued-1',
      trackerId: 't1',
      variantId: null,
      occurredAt: '2026-08-20T09:00:00.000Z',
      durationMinutes: null,
      note: null,
      createdAt: '2026-08-20T09:00:01.000Z',
    })
  })

  it('applies to a never-logged row', () => {
    const result = applyPendingEntries(payload(null), [queuedCreate()])

    expect(result.trackers[0]?.latestEntry?.id).toBe('queued-1')
  })

  it('lands a queued Variant log on that Variant, not on the Tracker', () => {
    const result = applyPendingEntries(payload(null), [queuedCreate({ variantId: 'v1' })])

    expect(result.trackers[0]?.variants[0]?.latestEntry?.id).toBe('queued-1')
    expect(result.trackers[0]?.latestEntry).toBeNull()
  })

  it('leaves a newer server Entry alone — a backdated queued log is not the latest', () => {
    const server = entry('server-1', '2026-08-21T00:00:00.000Z')

    const result = applyPendingEntries(payload(server), [
      queuedCreate({ occurredAt: '2026-08-19T00:00:00.000Z' }),
    ])

    expect(result.trackers[0]?.latestEntry).toEqual(server)
  })

  it('skips a dead-lettered item — the server rejected it, so the row was never logged', () => {
    const result = applyPendingEntries(payload(null), [queuedCreate({}, { status: 'dead' })])

    expect(result.trackers[0]?.latestEntry).toBeNull()
  })

  it('skips queued deletes — nothing here knows what the row was before', () => {
    const server = entry('server-1', '2026-08-21T00:00:00.000Z')
    const del: OutboxItem = {
      id: 'server-1',
      kind: 'delete',
      input: null,
      attempts: 0,
      status: 'pending',
      queuedAt: '2026-08-21T00:00:01.000Z',
    }

    expect(applyPendingEntries(payload(server), [del]).trackers[0]?.latestEntry).toEqual(server)
  })

  it('carries duration and note through', () => {
    const result = applyPendingEntries(payload(null), [
      queuedCreate({ durationMinutes: 40, note: 'felt good' }),
    ])

    expect(result.trackers[0]?.latestEntry).toMatchObject({ durationMinutes: 40, note: 'felt good' })
  })

  it('applies several queued logs, keeping the newest per row', () => {
    const result = applyPendingEntries(payload(null), [
      queuedCreate({ id: 'a', occurredAt: '2026-08-20T09:00:00.000Z' }),
      queuedCreate({ id: 'b', occurredAt: '2026-08-20T11:00:00.000Z' }),
      queuedCreate({ id: 'c', occurredAt: '2026-08-20T10:00:00.000Z' }),
    ])

    expect(result.trackers[0]?.latestEntry?.id).toBe('b')
  })

  it('leaves the payload untouched when the queue is empty', () => {
    const input = payload(entry('server-1', '2026-08-21T00:00:00.000Z'))

    expect(applyPendingEntries(input, [])).toBe(input)
  })

  it('ignores a queued log for a Tracker the payload no longer has', () => {
    const input = payload(null)

    const result = applyPendingEntries(input, [queuedCreate({ trackerId: 'gone' })])

    expect(result.trackers[0]?.latestEntry).toBeNull()
  })
})
