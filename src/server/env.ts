import { z } from 'zod'

/**
 * Boot step 1 per docs/tech-stack.md § Boot sequence. LAPSE_PASSWORD is
 * required and non-empty: an unset password must stop the boot, never open the
 * app (ADR-0003 amendment — this deployment is public).
 */
/**
 * A token typed into an Apple Shortcut sits there in plaintext, and Shortcuts
 * get exported and shared routinely — so this is a second secret, never the
 * login password. 32 hex chars is `openssl rand -hex 16`; the minimum is here
 * to stop a hand-typed "lapse123" from becoming a permanent bypass of the
 * rate-limited login route.
 */
const API_TOKEN_MIN_LENGTH = 32

/**
 * An empty value means "not configured", not "configured badly".
 * `.env.example` ships these keys blank and compose.yaml passes them through
 * as `KEY=${KEY:-}`, so an unset optional secret arrives as `''` rather than
 * as a missing key — without this, leaving a line blank in .env would fail
 * the length check below and stop the boot.
 */
const optionalSecret = (min: number, label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .min(min, `${label} must be at least ${min} characters, or unset`)
      .optional(),
  )

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATA_DIR: z.string().min(1).default('/data'),
  LAPSE_PASSWORD: z.string().min(1, 'LAPSE_PASSWORD must be set and non-empty'),
  /** enables `Authorization: Bearer` on /api/* for Shortcuts, scripts, and the bot below. */
  LAPSE_API_TOKEN: optionalSecret(API_TOKEN_MIN_LENGTH, 'LAPSE_API_TOKEN'),
  /** both required together, or the Telegram bot simply doesn't start. */
  LAPSE_TELEGRAM_BOT_TOKEN: optionalSecret(1, 'LAPSE_TELEGRAM_BOT_TOKEN'),
  LAPSE_TELEGRAM_CHAT_ID: optionalSecret(1, 'LAPSE_TELEGRAM_CHAT_ID'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`invalid environment — ${detail}`)
  }
  return parsed.data
}
