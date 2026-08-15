import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { Db } from '../db.js'
import { entries, trackers, variants } from '../schema.js'
import { createTestDb } from '../testing.js'

const PASSWORD = 'test'

/**
 * Fresh db + app + an authenticated session cookie, per docs/tech-stack.md §
 * Testing (Hono `app.request()` against an in-memory db, fresh per test).
 */
async function setup() {
  const db = createTestDb()
  const app = createApp({ db, password: PASSWORD })
  const login = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  return { db, app, cookie }
}

function insertTracker(db: Db, overrides: Partial<typeof trackers.$inferInsert> = {}) {
  const tracker = {
    id: 'tracker-1',
    name: 'Tyre pressure',
    categoryId: null,
    thresholdDays: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
  db.insert(trackers).values(tracker).run()
  return tracker
}

function insertVariant(db: Db, overrides: Partial<typeof variants.$inferInsert> = {}) {
  const variant = {
    id: 'variant-1',
    trackerId: 'tracker-1',
    name: 'volvo',
    thresholdDays: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
  db.insert(variants).values(variant).run()
  return variant
}

function insertEntry(db: Db, overrides: Partial<typeof entries.$inferInsert> = {}) {
  const entry = {
    id: 'entry-1',
    trackerId: 'tracker-1',
    variantId: null,
    occurredAt: new Date().toISOString(),
    durationMinutes: null,
    note: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
  db.insert(entries).values(entry).run()
  return entry
}

function postJson(
  app: Awaited<ReturnType<typeof setup>>['app'],
  path: string,
  body: unknown,
  cookie: string,
) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
}

function patchJson(
  app: Awaited<ReturnType<typeof setup>>['app'],
  path: string,
  body: unknown,
  cookie: string,
) {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
}

describe('POST /api/entries', () => {
  it('creates an entry with a server-generated id and createdAt', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)

    const res = await postJson(app, '/api/entries', { trackerId: 'tracker-1' }, cookie)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.trackerId).toBe('tracker-1')
    expect(body.variantId).toBeNull()
    expect(body.durationMinutes).toBeNull()
    expect(body.note).toBeNull()
    expect(body.createdAt).toBeTruthy()
    expect(db.select().from(entries).all()).toHaveLength(1)
  })

  it('defaults occurredAt to server-now when absent', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    const before = Date.now()

    const res = await postJson(app, '/api/entries', { trackerId: 'tracker-1' }, cookie)
    const body = await res.json()

    const occurredAtMs = new Date(body.occurredAt).getTime()
    expect(occurredAtMs).toBeGreaterThanOrEqual(before)
    expect(occurredAtMs).toBeLessThanOrEqual(Date.now())
  })

  it('replaying the same client-supplied id returns 200 with the existing row and creates nothing', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    const body = { id: 'client-id-1', trackerId: 'tracker-1', note: 'first' }

    const first = await postJson(app, '/api/entries', body, cookie)
    expect(first.status).toBe(201)
    const firstEntry = await first.json()

    const second = await postJson(app, '/api/entries', body, cookie)
    expect(second.status).toBe(200)
    const secondEntry = await second.json()

    expect(secondEntry).toEqual(firstEntry)
    expect(db.select().from(entries).all()).toHaveLength(1)
  })

  it('clamps a future occurredAt to server-now instead of rejecting it', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const res = await postJson(app, '/api/entries', { trackerId: 'tracker-1', occurredAt: futureIso }, cookie)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.occurredAt).not.toBe(futureIso)
    expect(new Date(body.occurredAt).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('accepts an entry against an archived tracker', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db, { archivedAt: new Date().toISOString() })

    const res = await postJson(app, '/api/entries', { trackerId: 'tracker-1' }, cookie)

    expect(res.status).toBe(201)
  })

  it('404s when the tracker does not exist', async () => {
    const { app, cookie } = await setup()

    const res = await postJson(app, '/api/entries', { trackerId: 'does-not-exist' }, cookie)

    expect(res.status).toBe(404)
  })

  it('400s when the variant does not belong to the given tracker', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db, { id: 'tracker-a' })
    insertTracker(db, { id: 'tracker-b' })
    insertVariant(db, { id: 'variant-b', trackerId: 'tracker-b' })

    const res = await postJson(
      app,
      '/api/entries',
      { trackerId: 'tracker-a', variantId: 'variant-b' },
      cookie,
    )

    expect(res.status).toBe(400)
  })

  it('400s when durationMinutes is out of range', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)

    const res = await postJson(
      app,
      '/api/entries',
      { trackerId: 'tracker-1', durationMinutes: 1441 },
      cookie,
    )

    expect(res.status).toBe(400)
  })

  it('400s when note exceeds 500 chars', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)

    const res = await postJson(
      app,
      '/api/entries',
      { trackerId: 'tracker-1', note: 'x'.repeat(501) },
      cookie,
    )

    expect(res.status).toBe(400)
  })

  it('400s when occurredAt is not a valid ISO timestamp', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)

    const res = await postJson(
      app,
      '/api/entries',
      { trackerId: 'tracker-1', occurredAt: 'not-a-date' },
      cookie,
    )

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/entries/:id', () => {
  it('edits occurredAt, durationMinutes, and note', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    insertEntry(db)
    const newOccurredAt = new Date('2026-01-01T00:00:00.000Z').toISOString()

    const res = await patchJson(
      app,
      '/api/entries/entry-1',
      { occurredAt: newOccurredAt, durationMinutes: 45, note: 'updated' },
      cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.occurredAt).toBe(newOccurredAt)
    expect(body.durationMinutes).toBe(45)
    expect(body.note).toBe('updated')

    const [stored] = db.select().from(entries).all()
    expect(stored?.occurredAt).toBe(newOccurredAt)
    expect(stored?.durationMinutes).toBe(45)
    expect(stored?.note).toBe('updated')
  })

  it('clamps a future occurredAt on edit', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    insertEntry(db)
    const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const res = await patchJson(app, '/api/entries/entry-1', { occurredAt: futureIso }, cookie)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(new Date(body.occurredAt).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('404s for an unknown entry id', async () => {
    const { app, cookie } = await setup()

    const res = await patchJson(app, '/api/entries/does-not-exist', { note: 'x' }, cookie)

    expect(res.status).toBe(404)
  })

  it('400s when the edited durationMinutes is out of range', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    insertEntry(db)

    const res = await patchJson(app, '/api/entries/entry-1', { durationMinutes: 0 }, cookie)

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/entries/:id', () => {
  it('deletes an existing entry', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    insertEntry(db)

    const res = await app.request('/api/entries/entry-1', { method: 'DELETE', headers: { cookie } })

    expect(res.status).toBe(204)
    expect(db.select().from(entries).all()).toHaveLength(0)
  })

  it('404s for an unknown entry id', async () => {
    const { app, cookie } = await setup()

    const res = await app.request('/api/entries/does-not-exist', {
      method: 'DELETE',
      headers: { cookie },
    })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/trackers/:id/entries', () => {
  it('lists entries newest-first', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    insertEntry(db, { id: 'e-old', occurredAt: '2026-01-01T00:00:00.000Z' })
    insertEntry(db, { id: 'e-new', occurredAt: '2026-01-03T00:00:00.000Z' })
    insertEntry(db, { id: 'e-mid', occurredAt: '2026-01-02T00:00:00.000Z' })

    const res = await app.request('/api/trackers/tracker-1/entries', { headers: { cookie } })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries.map((e: { id: string }) => e.id)).toEqual(['e-new', 'e-mid', 'e-old'])
    expect(body.nextCursor).toBeNull()
  })

  it('paginates across a page boundary where two entries share an occurredAt', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    // Tie-break must be id DESC: 'e-c' sorts after 'e-b' lexicographically.
    insertEntry(db, { id: 'e-a', occurredAt: '2026-01-03T00:00:00.000Z' })
    insertEntry(db, { id: 'e-b', occurredAt: '2026-01-01T00:00:00.000Z' })
    insertEntry(db, { id: 'e-c', occurredAt: '2026-01-01T00:00:00.000Z' })

    const firstPage = await app.request('/api/trackers/tracker-1/entries?limit=2', {
      headers: { cookie },
    })
    expect(firstPage.status).toBe(200)
    const firstBody = await firstPage.json()
    expect(firstBody.entries.map((e: { id: string }) => e.id)).toEqual(['e-a', 'e-c'])
    expect(firstBody.nextCursor).toBe('e-c')

    const secondPage = await app.request(
      `/api/trackers/tracker-1/entries?limit=2&cursor=${firstBody.nextCursor}`,
      { headers: { cookie } },
    )
    expect(secondPage.status).toBe(200)
    const secondBody = await secondPage.json()
    expect(secondBody.entries.map((e: { id: string }) => e.id)).toEqual(['e-b'])
    expect(secondBody.nextCursor).toBeNull()
  })

  it('404s for an unknown tracker id', async () => {
    const { app, cookie } = await setup()

    const res = await app.request('/api/trackers/does-not-exist/entries', { headers: { cookie } })

    expect(res.status).toBe(404)
  })

  it('400s for an invalid cursor', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)

    const res = await app.request('/api/trackers/tracker-1/entries?cursor=nope', {
      headers: { cookie },
    })

    expect(res.status).toBe(400)
  })

  it('accepts a large limit without erroring (cap applied silently)', async () => {
    const { db, app, cookie } = await setup()
    insertTracker(db)
    insertEntry(db)

    const res = await app.request('/api/trackers/tracker-1/entries?limit=9999', {
      headers: { cookie },
    })

    expect(res.status).toBe(200)
  })
})
