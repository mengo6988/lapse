import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { TrackerApiError, jsonRequest, mutationFetch } from './mutationClient'

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

describe('mutationFetch', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed body and marks the session authed on success', async () => {
    stubFetch({ ok: true, status: 201, json: async () => ({ id: 't1' }) })

    await expect(mutationFetch('/api/trackers', { method: 'POST' })).resolves.toEqual({ id: 't1' })
    expect(session.read()).toBe('authed')
  })

  it('sends same-origin credentials', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => ({}) })

    await mutationFetch('/api/trackers', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledWith('/api/trackers', expect.objectContaining({ credentials: 'same-origin' }))
  })

  it('throws TrackerApiError with parsed field errors on a 400 zod-validator failure', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'required' }] } }),
    })

    const error = await mutationFetch('/api/trackers', { method: 'POST' }).catch((e) => e)

    expect(error).toBeInstanceOf(TrackerApiError)
    expect((error as TrackerApiError).status).toBe(400)
    expect((error as TrackerApiError).fieldErrors).toEqual({ name: 'required' })
  })

  it('carries a generic message for a plain-string error body (e.g. 404/409)', async () => {
    stubFetch({ ok: false, status: 404, json: async () => ({ error: 'tracker not found' }) })

    const error = (await mutationFetch('/api/trackers/x', {}).catch((e) => e)) as TrackerApiError

    expect(error.status).toBe(404)
    expect(error.fieldErrors).toEqual({})
    expect(error.message).toBe('tracker not found')
  })

  it('falls back to a copy-voice message when the error body cannot be parsed', async () => {
    stubFetch({ ok: false, status: 500, json: async () => Promise.reject(new Error('no body')) })

    const error = (await mutationFetch('/api/trackers/x', {}).catch((e) => e)) as TrackerApiError

    expect(error.message).toBe("couldn't save — try again")
  })

  it('marks the session unauthorized and throws on a 401 without reading the body', async () => {
    const json = vi.fn()
    stubFetch({ ok: false, status: 401, json })

    await expect(mutationFetch('/api/trackers', {})).rejects.toBeInstanceOf(TrackerApiError)
    expect(session.read()).toBe('unauthorized')
    expect(json).not.toHaveBeenCalled()
  })

  it('surfaces a network failure as a TrackerApiError with the fallback message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const error = (await mutationFetch('/api/trackers', {}).catch((e) => e)) as TrackerApiError

    expect(error).toBeInstanceOf(TrackerApiError)
    expect(error.status).toBeNull()
    expect(error.message).toBe("couldn't save — try again")
  })

  it('resolves null on a 204 with no body, without calling .json()', async () => {
    const json = vi.fn()
    stubFetch({ ok: true, status: 204, json })

    await expect(mutationFetch('/api/variants/v1', { method: 'DELETE' })).resolves.toBeNull()
    expect(json).not.toHaveBeenCalled()
    expect(session.read()).toBe('authed')
  })
})

describe('jsonRequest', () => {
  it('builds a JSON content-type request with a stringified body', () => {
    expect(jsonRequest('POST', { name: 'x' })).toEqual({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    })
  })

  it('omits the body when none is given (e.g. DELETE)', () => {
    expect(jsonRequest('DELETE')).toEqual({ method: 'DELETE', headers: { 'content-type': 'application/json' } })
  })
})
