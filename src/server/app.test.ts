import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createTestDb } from './testing.js'

const PASSWORD = 'correct horse battery staple'

const testApp = () => createApp({ db: createTestDb(), password: PASSWORD })

describe('GET /api/health', () => {
  it('answers ok without a session', async () => {
    const res = await testApp().request('/api/health')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'ok' })
  })
})

describe('POST /api/auth/login', () => {
  it('sets a hardened session cookie for the right password', async () => {
    const res = await testApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    })

    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('rejects the wrong password without setting a cookie', async () => {
    const res = await testApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a malformed body', async () => {
    const res = await testApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

describe('auth middleware', () => {
  it('401s an unauthenticated api call', async () => {
    const res = await testApp().request('/api/bootstrap')

    expect(res.status).toBe(401)
  })

  it('lets a logged-in session through', async () => {
    const app = testApp()
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!

    const res = await app.request('/api/bootstrap', { headers: { cookie } })

    expect(res.status).not.toBe(401)
  })

  it('401s a forged cookie', async () => {
    const res = await testApp().request('/api/bootstrap', {
      headers: { cookie: 'lapse_session=not-the-real-token' },
    })

    expect(res.status).toBe(401)
  })
})
