import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUpdates, sendMessage, TelegramError } from './api.js'

const BOT_TOKEN = '123456:abcdef'

function stubFetch(payload: unknown, status = 200) {
  const fetchMock = vi.fn(
    async (_url: string, _init: RequestInit) => ({ status, json: async () => payload }) as unknown as Response,
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function initOf(fetchMock: ReturnType<typeof stubFetch>): RequestInit {
  return fetchMock.mock.calls[0]![1]
}

function bodyOf(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  return JSON.parse(initOf(fetchMock).body as string)
}

/** A fetch that never settles on its own — it only rejects if its signal aborts, same as the real thing. */
function stubHangingFetch() {
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getUpdates', () => {
  it('long-polls with the offset and asks only for messages', async () => {
    const fetchMock = stubFetch({ ok: true, result: [{ update_id: 7 }] })

    const updates = await getUpdates(BOT_TOKEN, 5, 30, new AbortController().signal)

    expect(updates).toEqual([{ update_id: 7 }])
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`)
    expect(bodyOf(fetchMock)).toEqual({ offset: 5, timeout: 30, allowed_updates: ['message'] })
  })

  it('throws with Telegram\'s own description when the call is refused', async () => {
    stubFetch({ ok: false, description: 'Unauthorized' })

    await expect(getUpdates(BOT_TOKEN, 0, 30, new AbortController().signal)).rejects.toThrow(
      TelegramError,
    )
  })

  it('propagates an external abort into the in-flight request, so a shutdown does not wait out the poll', async () => {
    const fetchMock = stubHangingFetch()
    const controller = new AbortController()

    const promise = getUpdates(BOT_TOKEN, 0, 30, controller.signal)
    controller.abort()

    await expect(promise).rejects.toThrow(TelegramError)
    expect(initOf(fetchMock).signal?.aborted).toBe(true)
  })

  it("gives up a little after Telegram's own long-poll timeout, so a dead socket can't hang the loop", async () => {
    vi.useFakeTimers()
    const fetchMock = stubHangingFetch()

    const promise = getUpdates(BOT_TOKEN, 0, 30, new AbortController().signal)
    const assertion = expect(promise).rejects.toThrow(TelegramError)
    await vi.advanceTimersByTimeAsync(30_000 + 10_000)
    await assertion

    expect(initOf(fetchMock).signal?.aborted).toBe(true)
  })
})

describe('sendMessage', () => {
  it('sends plain text to the one allowed chat', async () => {
    const fetchMock = stubFetch({ ok: true, result: {} })

    await sendMessage(BOT_TOKEN, { chatId: '4242', text: 'logged ✓ vacuuming' })

    expect(bodyOf(fetchMock)).toEqual({ chat_id: '4242', text: 'logged ✓ vacuuming' })
  })

  it('builds a persistent one-button-per-row keyboard', async () => {
    const fetchMock = stubFetch({ ok: true, result: {} })

    await sendMessage(BOT_TOKEN, { chatId: '4242', text: 'lapse', keyboard: ['vacuuming', 'run'] })

    expect(bodyOf(fetchMock).reply_markup).toEqual({
      keyboard: [[{ text: 'vacuuming' }], [{ text: 'run' }]],
      resize_keyboard: true,
      is_persistent: true,
    })
  })

  it('leaves the showing keyboard alone when none is given', async () => {
    const fetchMock = stubFetch({ ok: true, result: {} })

    await sendMessage(BOT_TOKEN, { chatId: '4242', text: 'nothing slipping', keyboard: null })

    expect(bodyOf(fetchMock)).not.toHaveProperty('reply_markup')
  })

  it("gives up after 10 seconds, so one stuck reply can't block the loop from answering the next message", async () => {
    vi.useFakeTimers()
    const fetchMock = stubHangingFetch()

    const promise = sendMessage(BOT_TOKEN, { chatId: '4242', text: 'logged ✓ vacuuming' })
    const assertion = expect(promise).rejects.toThrow(TelegramError)
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion

    expect(initOf(fetchMock).signal?.aborted).toBe(true)
  })
})
