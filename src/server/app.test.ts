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

  it('refuses an oversized body before reading it — one process, anyone can reach this route', async () => {
    const body = JSON.stringify({ password: 'x'.repeat(4096) })
    const res = await testApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
      body,
    })

    expect(res.status).toBe(413)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie and succeeds with no session at all', async () => {
    const res = await testApp().request('/api/auth/logout', { method: 'POST' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('Max-Age=0')
  })

  it('clears the session cookie even against a forged one — a forced logout must always land', async () => {
    const res = await testApp().request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie: 'lapse_session=not-the-real-token' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0')
  })

  it('clears a genuine logged-in session cookie', async () => {
    const app = testApp()
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!

    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })

    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0')
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

describe('login rate limit', () => {
  const attemptLogin = (app: ReturnType<typeof testApp>, xForwardedFor?: string) =>
    app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(xForwardedFor ? { 'x-forwarded-for': xForwardedFor } : {}),
      },
      body: JSON.stringify({ password: 'wrong' }),
    })

  it('refuses the 11th attempt from the same client within the window', async () => {
    const app = testApp()

    for (let i = 0; i < 10; i++) {
      const res = await attemptLogin(app, '9.9.9.9')
      expect(res.status).toBe(401)
    }

    const res = await attemptLogin(app, '9.9.9.9')
    expect(res.status).toBe(429)
  })

  it('does not rate limit a different client', async () => {
    const app = testApp()

    for (let i = 0; i < 10; i++) {
      await attemptLogin(app, '9.9.9.9')
    }
    expect((await attemptLogin(app, '9.9.9.9')).status).toBe(429)

    const res = await attemptLogin(app, '1.1.1.1')
    expect(res.status).toBe(401)
  })

  it('leaves every other route unaffected', async () => {
    const app = testApp()

    for (let i = 0; i < 15; i++) {
      const res = await app.request('/api/health', { headers: { 'x-forwarded-for': '9.9.9.9' } })
      expect(res.status).toBe(200)
    }
  })
})

describe('bearer token access', () => {
  const API_TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
  const tokenApp = () => createApp({ db: createTestDb({ seed: true }), password: PASSWORD, apiToken: API_TOKEN })

  it('accepts a valid bearer token where the cookie would have been', async () => {
    const res = await tokenApp().request('/api/bootstrap', {
      headers: { authorization: `Bearer ${API_TOKEN}` },
    })

    expect(res.status).toBe(200)
  })

  it('rejects a wrong token', async () => {
    const res = await tokenApp().request('/api/bootstrap', {
      headers: { authorization: 'Bearer 00000000000000000000000000000000' },
    })

    expect(res.status).toBe(401)
  })

  it('rejects a token presented without the Bearer scheme', async () => {
    const res = await tokenApp().request('/api/bootstrap', { headers: { authorization: API_TOKEN } })

    expect(res.status).toBe(401)
  })

  it('rejects every bearer token when none is configured', async () => {
    const res = await testApp().request('/api/bootstrap', {
      headers: { authorization: `Bearer ${API_TOKEN}` },
    })

    expect(res.status).toBe(401)
  })

  it('still refuses an unauthenticated request', async () => {
    expect((await tokenApp().request('/api/bootstrap')).status).toBe(401)
  })

  it('accepts a session cookie as before', async () => {
    const app = tokenApp()
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    })
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

    expect((await app.request('/api/bootstrap', { headers: { cookie } })).status).toBe(200)
  })
})
