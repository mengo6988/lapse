/**
 * The four Bot API calls this bot makes, over plain `fetch`.
 *
 * No grammY, no telegraf. Those exist to route middleware, manage sessions and
 * model every update type; this bot answers text messages from exactly one
 * chat. The whole surface it needs is a POST to
 * https://api.telegram.org/bot<token>/<method> with a JSON body — the token in
 * the path *is* the authentication, there is nothing to sign.
 */
const API_ROOT = 'https://api.telegram.org'

export interface TelegramMessage {
  readonly message_id: number
  readonly chat: { readonly id: number }
  readonly text?: string
}

export interface TelegramUpdate {
  readonly update_id: number
  readonly message?: TelegramMessage
}

export interface SendMessageOptions {
  readonly chatId: string
  readonly text: string
  /** a persistent button-per-row keyboard; `null` leaves whatever is showing alone. */
  readonly keyboard?: readonly string[] | null
}

export class TelegramError extends Error {}

async function call<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_ROOT}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal ?? null,
  })

  const payload = (await response.json()) as { ok: boolean; result?: T; description?: string }
  if (!payload.ok) {
    throw new TelegramError(`${method} failed: ${payload.description ?? response.status}`)
  }
  return payload.result as T
}

/**
 * Long polling rather than a webhook. A webhook would need this app to know
 * its own public URL, register it at boot, and verify a second shared secret
 * on an unauthenticated route — where `getUpdates` needs the bot token and
 * nothing else, and works identically on a laptop and behind Traefik. The
 * connection Telegram holds open for `timeoutSeconds` costs one socket.
 */
export function getUpdates(
  botToken: string,
  offset: number,
  timeoutSeconds: number,
  signal: AbortSignal,
): Promise<TelegramUpdate[]> {
  return call<TelegramUpdate[]>(
    botToken,
    'getUpdates',
    { offset, timeout: timeoutSeconds, allowed_updates: ['message'] },
    signal,
  )
}

export function sendMessage(botToken: string, options: SendMessageOptions): Promise<unknown> {
  return call(botToken, 'sendMessage', {
    chat_id: options.chatId,
    text: options.text,
    ...(options.keyboard
      ? {
          reply_markup: {
            keyboard: options.keyboard.map((label) => [{ text: label }]),
            resize_keyboard: true,
            is_persistent: true,
          },
        }
      : {}),
  })
}
