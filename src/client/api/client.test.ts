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

/**
 * A fetch stub that behaves like the real thing with respect to its
 * `init.signal`: already aborted at call time rejects right away, aborted
 * later rejects then, and otherwise the returned promise never settles on
 * its own. Used for the deadline tests below, where what unblocks the
 * request is the abort, not a resolved response.
 */
function stubAbortAwareFetch() {
  const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
      if (init?.signal?.aborted) abort()
      else init?.signal?.addEventListener('abort', abort, { once: true })
    })
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
    vi.useRealTimers()
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

  it('rejects with a null-status ApiError after the deadline when the request never settles', async () => {
    vi.useFakeTimers()
    stubAbortAwareFetch()

    const pending = apiFetch('/api/bootstrap')
    const assertion = expect(pending).rejects.toMatchObject({ name: 'ApiError', status: null })
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion

    vi.useRealTimers()
  })

  it('merges a caller-supplied signal with the deadline: the caller aborting rejects without waiting 15s', async () => {
    stubAbortAwareFetch()
    const controller = new AbortController()

    const pending = apiFetch('/api/bootstrap', { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'ApiError', status: null })
  })

  it('merges a caller-supplied signal with the deadline: an already-aborted caller signal rejects immediately', async () => {
    stubAbortAwareFetch()
    const controller = new AbortController()
    controller.abort()

    await expect(apiFetch('/api/bootstrap', { signal: controller.signal })).rejects.toMatchObject({
      name: 'ApiError',
      status: null,
    })
  })
})
