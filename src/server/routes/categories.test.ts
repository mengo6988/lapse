import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { Db } from '../db.js'
import { categories, trackers } from '../schema.js'
import { createTestDb } from '../testing.js'

const PASSWORD = 'test'

async function buildAuthedApp() {
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

function postCategory(app: Awaited<ReturnType<typeof buildAuthedApp>>['app'], cookie: string, body: unknown) {
  return app.request('/api/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
}

function insertCategory(db: Db, overrides: Partial<{ id: string; name: string; color: string; createdAt: string }> = {}) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'house',
    color: overrides.color ?? '#89b4fa',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }
  db.insert(categories).values(row).run()
  return row
}

describe('GET /api/categories', () => {
  it('returns an empty list when none exist', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await app.request('/api/categories', { headers: { cookie } })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([])
  })

  it('returns categories that exist', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    insertCategory(db, { name: 'car', color: '#f9e2af' })

    const res = await app.request('/api/categories', { headers: { cookie } })
    const body = (await res.json()) as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ name: 'car', color: '#f9e2af' })
  })
})

describe('POST /api/categories', () => {
  it('creates a category with a generated id and createdAt', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await postCategory(app, cookie, { name: 'health', color: '#a6e3a1' })
    const body = (await res.json()) as { id: string; name: string; color: string; createdAt: string }

    expect(res.status).toBe(201)
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.name).toBe('health')
    expect(body.color).toBe('#a6e3a1')
    expect(() => new Date(body.createdAt).toISOString()).not.toThrow()
  })

  it('trims the name', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await postCategory(app, cookie, { name: '  personal  ', color: '#cba6f7' })
    const body = (await res.json()) as { name: string }

    expect(res.status).toBe(201)
    expect(body.name).toBe('personal')
  })

  it('rejects an empty name with 400 field errors', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await postCategory(app, cookie, { name: '   ', color: '#a6e3a1' })
    const body = (await res.json()) as { success: boolean; error: unknown }

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
  })

  it('rejects a name over 100 chars with 400', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await postCategory(app, cookie, { name: 'x'.repeat(101), color: '#a6e3a1' })

    expect(res.status).toBe(400)
  })

  it('rejects an uppercase-hex color with 400', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await postCategory(app, cookie, { name: 'house', color: '#AABBCC' })

    expect(res.status).toBe(400)
  })

  it('rejects a malformed color with 400', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await postCategory(app, cookie, { name: 'house', color: 'blue' })

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/categories/:id', () => {
  it('updates the name and color', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const category = insertCategory(db)

    const res = await app.request(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'garage', color: '#f38ba8' }),
    })
    const body = (await res.json()) as { id: string; name: string; color: string }

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ id: category.id, name: 'garage', color: '#f38ba8' })
  })

  it('allows a partial update of just the color', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const category = insertCategory(db, { name: 'house' })

    const res = await app.request(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ color: '#f38ba8' }),
    })
    const body = (await res.json()) as { name: string; color: string }

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ name: 'house', color: '#f38ba8' })
  })

  it('404s for an unknown id', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await app.request('/api/categories/does-not-exist', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'garage' }),
    })

    expect(res.status).toBe(404)
  })

  it('rejects an invalid color with 400', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const category = insertCategory(db)

    const res = await app.request(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ color: 'not-a-color' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/categories/:id', () => {
  it('deletes the category', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const category = insertCategory(db)

    const res = await app.request(`/api/categories/${category.id}`, { method: 'DELETE', headers: { cookie } })

    expect(res.status).toBe(200)
    const remaining = await app.request('/api/categories', { headers: { cookie } })
    await expect(remaining.json()).resolves.toEqual([])
    void db
  })

  it('404s for an unknown id', async () => {
    const { app, cookie } = await buildAuthedApp()

    const res = await app.request('/api/categories/does-not-exist', { method: 'DELETE', headers: { cookie } })

    expect(res.status).toBe(404)
  })

  it('leaves a Tracker uncategorised instead of deleting it', async () => {
    const { app, db, cookie } = await buildAuthedApp()
    const category = insertCategory(db)
    const trackerId = crypto.randomUUID()
    db.insert(trackers)
      .values({
        id: trackerId,
        name: 'vacuum',
        categoryId: category.id,
        createdAt: new Date().toISOString(),
      })
      .run()

    const res = await app.request(`/api/categories/${category.id}`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)

    const tracker = db.select().from(trackers).where(eq(trackers.id, trackerId)).get()
    expect(tracker?.categoryId).toBeNull()
  })
})
