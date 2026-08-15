/**
 * Native `<input type="color">` values are spec'd to always serialize as
 * lowercase `#rrggbb`, but this normalizes defensively at the client
 * boundary anyway (build ticket 22) — the server's validator
 * (src/server/routes/categories.ts) rejects anything but lowercase hex, and
 * a browser quirk shouldn't turn into a confusing 400 the user can't explain.
 */
export function normalizeColor(value: string): string {
  return value.toLowerCase()
}
