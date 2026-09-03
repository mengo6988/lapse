import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createApp, type App } from '../app.js'
import { createTestDb } from '../testing.js'
import { entries, categories, variants } from '../schema.js'
import type { Db } from '../db.js'

const PASSWORD = 'test'

/**
 * A logged-in app plus the raw db handle, so tests can assert on rows the
 * API surface intentionally never returns (e.g. a soft-deleted variant row).
 */
async function setup(): Promise<{ app: App; db: Db; cookie: string }> {
  const db = createTestDb()
  const app = createApp({ db, password: PASSWORD })
  const login = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  return { app, db, cookie }
}

async function req(
  app: App,
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('POST /api/trackers', () => {
  it('creates a tracker with just a name', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', { name: 'Water the plants' })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({
      name: 'Water the plants',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      variants: [],
    })
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt)
  })

  it('creates a tracker with categoryId, thresholdDays, and inline variants', async () => {
    const { app, db, cookie } = await setup()
    const categoryId = 'cat-1'
    db.insert(categories)
      .values({ id: categoryId, name: 'house', color: '#ffffff', createdAt: new Date().toISOString() })
      .run()

    const res = await req(app, cookie, 'POST', '/api/trackers', {
      name: 'Rotate tyres',
      categoryId,
      thresholdDays: 90,
      variants: [{ name: 'front' }, { name: 'rear', thresholdDays: 60 }],
    })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.categoryId).toBe(categoryId)
    expect(body.thresholdDays).toBe(90)
    expect(body.variants).toHaveLength(2)
    expect(body.variants.map((v: { name: string }) => v.name).sort()).toEqual(['front', 'rear'])
    const rear = body.variants.find((v: { name: string }) => v.name === 'rear')
    expect(rear.thresholdDays).toBe(60)
    const front = body.variants.find((v: { name: string }) => v.name === 'front')
    expect(front.thresholdDays).toBeNull()
    for (const v of body.variants) {
      expect(typeof v.id).toBe('string')
      expect(v.trackerId).toBe(body.id)
    }
  })

  it('honors a client-supplied id', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', {
      id: 'client-generated-id',
      name: 'Outbox tracker',
    })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('client-generated-id')
  })

  it('rejects a missing name with 400 and field errors', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', {})
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
  })

  it('rejects a name over 100 chars', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', { name: 'x'.repeat(101) })

    expect(res.status).toBe(400)
  })

  it('rejects a blank / whitespace-only name', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', { name: '   ' })

    expect(res.status).toBe(400)
  })

  it('rejects thresholdDays out of range', async () => {
    const { app, cookie } = await setup()

    const tooLow = await req(app, cookie, 'POST', '/api/trackers', {
      name: 'a',
      thresholdDays: 0,
    })
    const tooHigh = await req(app, cookie, 'POST', '/api/trackers', {
      name: 'a',
      thresholdDays: 3651,
    })
    const notInt = await req(app, cookie, 'POST', '/api/trackers', {
      name: 'a',
      thresholdDays: 1.5,
    })

    expect(tooLow.status).toBe(400)
    expect(tooHigh.status).toBe(400)
    expect(notInt.status).toBe(400)
  })

  // Build ticket 27: the client's own cap has to match this exactly, and
  // this is the one test that would fail if the two ever drifted.
  it('accepts a thresholdDays right at the 3650-day cap', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', { name: 'a', thresholdDays: 3650 })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.thresholdDays).toBe(3650)
  })

  it('rejects an unknown categoryId with 400', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers', {
      name: 'Orphan',
      categoryId: 'does-not-exist',
    })

    expect(res.status).toBe(400)
  })

  it('409s a client id that already belongs to another tracker', async () => {
    const { app, cookie } = await setup()
    await req(app, cookie, 'POST', '/api/trackers', { id: 'dup-id', name: 'first' })

    const res = await req(app, cookie, 'POST', '/api/trackers', { id: 'dup-id', name: 'second' })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body).toEqual({ error: 'id already exists' })
  })

  it('409s a colliding inline variant id and leaves no half-built tracker behind', async () => {
    const { app, cookie } = await setup()
    await req(app, cookie, 'POST', '/api/trackers', {
      name: 'first',
      variants: [{ id: 'dup-variant', name: 'v' }],
    })

    const res = await req(app, cookie, 'POST', '/api/trackers', {
      id: 'second-tracker',
      name: 'second',
      variants: [{ id: 'dup-variant', name: 'v' }],
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'id already exists' })

    // the rolled-back Tracker row must be gone, or the caller's retry with
    // the same id would 409 on the Tracker instead and never succeed.
    const retry = await req(app, cookie, 'POST', '/api/trackers', {
      id: 'second-tracker',
      name: 'second',
      variants: [{ name: 'v' }],
    })
    expect(retry.status).toBe(201)
  })
})

describe('PATCH /api/trackers/:id', () => {
  async function createTracker(app: App, cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await req(app, cookie, 'POST', '/api/trackers', { name: 'Original', ...overrides })
    return res.json()
  }

  it('404s an unknown tracker', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'PATCH', '/api/trackers/nope', { name: 'x' })

    expect(res.status).toBe(404)
  })

  it('edits the name', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      name: 'Renamed',
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.name).toBe('Renamed')
  })

  it('sets thresholdDays', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      thresholdDays: 14,
    })
    const body = await res.json()

    expect(body.thresholdDays).toBe(14)
  })

  it('leaves thresholdDays untouched when the field is absent', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie, { thresholdDays: 30 })

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      name: 'Still thresholded',
    })
    const body = await res.json()

    expect(body.thresholdDays).toBe(30)
  })

  it('clears thresholdDays when explicitly set to null', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie, { thresholdDays: 30 })

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      thresholdDays: null,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.thresholdDays).toBeNull()
  })

  it('archives by setting archivedAt', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      archived: true,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.archivedAt).not.toBeNull()
    expect(new Date(body.archivedAt).toISOString()).toBe(body.archivedAt)
  })

  it('unarchives by clearing archivedAt', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie)
    await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, { archived: true })

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      archived: false,
    })
    const body = await res.json()

    expect(body.archivedAt).toBeNull()
  })

  it('edits and clears categoryId', async () => {
    const { app, db, cookie } = await setup()
    const categoryId = 'cat-2'
    db.insert(categories)
      .values({ id: categoryId, name: 'car', color: '#000000', createdAt: new Date().toISOString() })
      .run()
    const tracker = await createTracker(app, cookie)

    const set = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, { categoryId })
    expect((await set.json()).categoryId).toBe(categoryId)

    const cleared = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      categoryId: null,
    })
    expect((await cleared.json()).categoryId).toBeNull()
  })

  it('rejects an unknown categoryId with 400', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, {
      categoryId: 'ghost',
    })

    expect(res.status).toBe(400)
  })

  it('rejects an invalid name', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, { name: '' })

    expect(res.status).toBe(400)
  })

  it('returns non-deleted variants alongside the tracker', async () => {
    const { app, cookie } = await setup()
    const tracker = await createTracker(app, cookie, { variants: [{ name: 'a' }, { name: 'b' }] })

    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, { name: 'x' })
    const body = await res.json()

    expect(body.variants).toHaveLength(2)
  })
})

describe('DELETE /api/trackers/:id', () => {
  it('404s an unknown tracker', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'DELETE', '/api/trackers/nope')

    expect(res.status).toBe(404)
  })

  it('refuses to delete an unarchived tracker with 409', async () => {
    const { app, cookie } = await setup()
    const created = await (await req(app, cookie, 'POST', '/api/trackers', { name: 'x' })).json()

    const res = await req(app, cookie, 'DELETE', `/api/trackers/${created.id}`)

    expect(res.status).toBe(409)
  })

  it('hard-deletes an archived tracker, cascading variants and entries', async () => {
    const { app, db, cookie } = await setup()
    const created = await (
      await req(app, cookie, 'POST', '/api/trackers', {
        name: 'x',
        variants: [{ name: 'v1' }],
      })
    ).json()
    const variantId = created.variants[0].id
    db.insert(entries)
      .values({
        id: 'entry-1',
        trackerId: created.id,
        variantId,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .run()
    await req(app, cookie, 'PATCH', `/api/trackers/${created.id}`, { archived: true })

    const res = await req(app, cookie, 'DELETE', `/api/trackers/${created.id}`)

    expect(res.status).toBe(204)
    const remainingEntries = db.select().from(entries).where(eq(entries.trackerId, created.id)).all()
    expect(remainingEntries).toHaveLength(0)
    const refetch = await req(app, cookie, 'PATCH', `/api/trackers/${created.id}`, { name: 'y' })
    expect(refetch.status).toBe(404)
  })
})

describe('POST /api/trackers/:id/variants', () => {
  it('404s an unknown tracker', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'POST', '/api/trackers/nope/variants', { name: 'v' })

    expect(res.status).toBe(404)
  })

  it('adds a variant with just a name', async () => {
    const { app, cookie } = await setup()
    const tracker = await (await req(app, cookie, 'POST', '/api/trackers', { name: 't' })).json()

    const res = await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, {
      name: 'front tyre',
    })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({ name: 'front tyre', trackerId: tracker.id, thresholdDays: null, deletedAt: null })
    expect(typeof body.id).toBe('string')
  })

  it('adds a variant with a thresholdDays override', async () => {
    const { app, cookie } = await setup()
    const tracker = await (await req(app, cookie, 'POST', '/api/trackers', { name: 't' })).json()

    const res = await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, {
      name: 'rear tyre',
      thresholdDays: 45,
    })
    const body = await res.json()

    expect(body.thresholdDays).toBe(45)
  })

  it('honors a client-supplied id', async () => {
    const { app, cookie } = await setup()
    const tracker = await (await req(app, cookie, 'POST', '/api/trackers', { name: 't' })).json()

    const res = await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, {
      id: 'client-variant-id',
      name: 'v',
    })
    const body = await res.json()

    expect(body.id).toBe('client-variant-id')
  })

  it('rejects an invalid name with 400', async () => {
    const { app, cookie } = await setup()
    const tracker = await (await req(app, cookie, 'POST', '/api/trackers', { name: 't' })).json()

    const res = await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, { name: '' })

    expect(res.status).toBe(400)
  })

  it('rejects an out-of-range thresholdDays with 400', async () => {
    const { app, cookie } = await setup()
    const tracker = await (await req(app, cookie, 'POST', '/api/trackers', { name: 't' })).json()

    const res = await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, {
      name: 'v',
      thresholdDays: 5000,
    })

    expect(res.status).toBe(400)
  })

  it('409s a client id that already belongs to another variant', async () => {
    const { app, cookie } = await setup()
    const tracker = await (await req(app, cookie, 'POST', '/api/trackers', { name: 't' })).json()
    await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, { id: 'dup-variant', name: 'first' })

    const res = await req(app, cookie, 'POST', `/api/trackers/${tracker.id}/variants`, {
      id: 'dup-variant',
      name: 'second',
    })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body).toEqual({ error: 'id already exists' })
  })
})

describe('PATCH /api/variants/:id', () => {
  async function createTrackerWithVariant(app: App, cookie: string, thresholdDays?: number | null) {
    const tracker = await (
      await req(app, cookie, 'POST', '/api/trackers', {
        name: 't',
        variants: [{ name: 'v', ...(thresholdDays === undefined ? {} : { thresholdDays }) }],
      })
    ).json()
    return tracker.variants[0]
  }

  it('404s an unknown variant', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'PATCH', '/api/variants/nope', { name: 'x' })

    expect(res.status).toBe(404)
  })

  it('renames the variant', async () => {
    const { app, cookie } = await setup()
    const variant = await createTrackerWithVariant(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/variants/${variant.id}`, { name: 'renamed' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.name).toBe('renamed')
  })

  it('sets thresholdDays', async () => {
    const { app, cookie } = await setup()
    const variant = await createTrackerWithVariant(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/variants/${variant.id}`, { thresholdDays: 20 })
    const body = await res.json()

    expect(body.thresholdDays).toBe(20)
  })

  it('leaves thresholdDays untouched when absent from the body', async () => {
    const { app, cookie } = await setup()
    const variant = await createTrackerWithVariant(app, cookie, 25)

    const res = await req(app, cookie, 'PATCH', `/api/variants/${variant.id}`, { name: 'x' })
    const body = await res.json()

    expect(body.thresholdDays).toBe(25)
  })

  it('clears thresholdDays (inherit parent) when explicitly null', async () => {
    const { app, cookie } = await setup()
    const variant = await createTrackerWithVariant(app, cookie, 25)

    const res = await req(app, cookie, 'PATCH', `/api/variants/${variant.id}`, {
      thresholdDays: null,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.thresholdDays).toBeNull()
  })

  it('rejects an invalid name with 400', async () => {
    const { app, cookie } = await setup()
    const variant = await createTrackerWithVariant(app, cookie)

    const res = await req(app, cookie, 'PATCH', `/api/variants/${variant.id}`, { name: 'x'.repeat(101) })

    expect(res.status).toBe(400)
  })

  it('404s a soft-deleted variant', async () => {
    const { app, cookie } = await setup()
    const variant = await createTrackerWithVariant(app, cookie)
    await req(app, cookie, 'DELETE', `/api/variants/${variant.id}`)

    const res = await req(app, cookie, 'PATCH', `/api/variants/${variant.id}`, { name: 'x' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/variants/:id', () => {
  it('404s an unknown variant', async () => {
    const { app, cookie } = await setup()

    const res = await req(app, cookie, 'DELETE', '/api/variants/nope')

    expect(res.status).toBe(404)
  })

  it('soft-deletes: sets deletedAt but keeps the row', async () => {
    const { app, db, cookie } = await setup()
    const tracker = await (
      await req(app, cookie, 'POST', '/api/trackers', { name: 't', variants: [{ name: 'v' }] })
    ).json()
    const variantId = tracker.variants[0].id

    const res = await req(app, cookie, 'DELETE', `/api/variants/${variantId}`)

    expect(res.status).toBe(204)
    const [row] = db.select().from(variants).where(eq(variants.id, variantId)).all()
    expect(row).toBeDefined()
    expect(row!.deletedAt).not.toBeNull()
  })

  it('404s a second delete of the same variant', async () => {
    const { app, cookie } = await setup()
    const tracker = await (
      await req(app, cookie, 'POST', '/api/trackers', { name: 't', variants: [{ name: 'v' }] })
    ).json()
    const variantId = tracker.variants[0].id
    await req(app, cookie, 'DELETE', `/api/variants/${variantId}`)

    const res = await req(app, cookie, 'DELETE', `/api/variants/${variantId}`)

    expect(res.status).toBe(404)
  })

  it('keeps entries pointing at the deleted variant (history keeps its label)', async () => {
    const { app, db, cookie } = await setup()
    const tracker = await (
      await req(app, cookie, 'POST', '/api/trackers', { name: 't', variants: [{ name: 'v' }] })
    ).json()
    const variantId = tracker.variants[0].id
    db.insert(entries)
      .values({
        id: 'entry-x',
        trackerId: tracker.id,
        variantId,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .run()

    await req(app, cookie, 'DELETE', `/api/variants/${variantId}`)

    const [entry] = db.select().from(entries).where(eq(entries.id, 'entry-x')).all()
    expect(entry!.variantId).toBe(variantId)
  })

  it('excludes the soft-deleted variant from the tracker read (via PATCH response)', async () => {
    const { app, cookie } = await setup()
    const tracker = await (
      await req(app, cookie, 'POST', '/api/trackers', {
        name: 't',
        variants: [{ name: 'keep' }, { name: 'gone' }],
      })
    ).json()
    const goneId = tracker.variants.find((v: { name: string }) => v.name === 'gone').id

    await req(app, cookie, 'DELETE', `/api/variants/${goneId}`)
    const res = await req(app, cookie, 'PATCH', `/api/trackers/${tracker.id}`, { name: 't' })
    const body = await res.json()

    expect(body.variants).toHaveLength(1)
    expect(body.variants[0].name).toBe('keep')
  })
})
