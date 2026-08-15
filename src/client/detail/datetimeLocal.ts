/**
 * Conversions between an Entry's stored UTC ISO `occurredAt` and the value
 * an `<input type="datetime-local">` needs/produces, which is always
 * unzoned device-local time (docs/spec.md: "Timestamps stored UTC ...
 * displayed and day-bucketed in device-local time"). Used only by
 * EntryEditSheet's time field.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/** null for anything the browser's datetime-local input wouldn't accept. */
export function fromDatetimeLocalValue(value: string): string | null {
  if (value.trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
