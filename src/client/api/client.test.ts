import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { ApiError, apiFetch } from './client'

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('apiFetch', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed JSON body on success', async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({ hello: 'world' }) })

    await expect(apiFetch('/api/bootstrap')).resolves.toEqual({ hello: 'world' })
  })

  it('marks the session authed on a successful response', async () => {
    stubFetch({ ok: true, status: 200, json: async () => ({}) })

    await apiFetch('/api/bootstrap')

    expect(session.read()).toBe('authed')
  })

  it('marks the session unauthorized and throws on a 401, without an unhandled rejection', async () => {
    stubFetch({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })

    await expect(apiFetch('/api/bootstrap')).rejects.toThrow(ApiError)
    expect(session.read()).toBe('unauthorized')
  })

  it('throws on other non-ok statuses without touching session state', async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })

    await expect(apiFetch('/api/bootstrap')).rejects.toThrow(ApiError)
    expect(session.read()).toBe('unknown')
  })

  it('sends cookies same-origin so the session cookie rides along', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => ({}) })

    await apiFetch('/api/bootstrap')

    expect(fetchMock).toHaveBeenCalledWith('/api/bootstrap', expect.objectContaining({ credentials: 'same-origin' }))
  })
})
