/**
 * Parses the two failure shapes the tracker/variant routes return
 * (src/server/routes/trackers.ts): a Zod-validator 400
 * (`{ success: false, error: { issues: [...] } }`, from `@hono/zod-validator`'s
 * default hook) carries per-field messages; everything else (404, 409, a
 * hand-written 400) is a plain `{ error: string }`. The server already writes
 * those strings in the copy voice ("tracker not found"), so they're used
 * as-is rather than re-worded here.
 */
const FALLBACK_MESSAGE = "couldn't save — try again"

interface ZodIssue {
  path: (string | number)[]
  message: string
}

interface ZodValidatorFailure {
  success: false
  error: { issues: ZodIssue[] }
}

function isZodValidatorFailure(body: unknown): body is ZodValidatorFailure {
  if (typeof body !== 'object' || body === null) return false
  const candidate = body as { success?: unknown; error?: unknown }
  if (candidate.success !== false) return false
  if (typeof candidate.error !== 'object' || candidate.error === null) return false
  return Array.isArray((candidate.error as { issues?: unknown }).issues)
}

/** field path (dot-joined) -> first message for that field. */
export function parseFieldErrors(body: unknown): Record<string, string> {
  if (!isZodValidatorFailure(body)) return {}

  const errors: Record<string, string> = {}
  for (const issue of body.error.issues) {
    const key = issue.path.join('.')
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}

/** the message to show when an error isn't attributable to one field. */
export function parseGenericError(body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const error = (body as { error?: unknown }).error
    if (typeof error === 'string' && error.length > 0) return error
  }
  return FALLBACK_MESSAGE
}
