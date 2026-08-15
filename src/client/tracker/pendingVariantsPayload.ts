/**
 * Turns create-flow Variant drafts into the POST /trackers request body, and
 * maps a failed response's per-variant field errors back onto the right
 * draft row. A blank draft never blocks create (docs/design.md: Variants
 * are "add rows", never required) — it's dropped rather than sent — which
 * means the payload's index for a kept row can differ from its index in
 * PendingVariantsEditor's own list; `originalIndexByPayloadIndex` is that
 * translation.
 */
import type { PendingVariant } from './PendingVariantsEditor'

export interface VariantPayloadEntry {
  name: string
  thresholdDays: number | null
}

export function buildVariantsPayload(pendingVariants: readonly PendingVariant[]): {
  payload: VariantPayloadEntry[]
  originalIndexByPayloadIndex: number[]
} {
  const kept = pendingVariants
    .map((variant, originalIndex) => ({ variant, originalIndex }))
    .filter(({ variant }) => variant.name.trim().length > 0)

  return {
    payload: kept.map(({ variant }) => ({ name: variant.name.trim(), thresholdDays: variant.thresholdDays })),
    originalIndexByPayloadIndex: kept.map(({ originalIndex }) => originalIndex),
  }
}

const VARIANT_FIELD_ERROR = /^variants\.(\d+)\.(.+)$/

export function remapVariantFieldErrors(
  fieldErrors: Record<string, string>,
  originalIndexByPayloadIndex: readonly number[],
): Record<string, string> {
  const remapped: Record<string, string> = {}
  for (const [key, message] of Object.entries(fieldErrors)) {
    const match = VARIANT_FIELD_ERROR.exec(key)
    if (!match) {
      remapped[key] = message
      continue
    }
    const originalIndex = originalIndexByPayloadIndex[Number(match[1])]
    if (originalIndex === undefined) continue
    remapped[`variants.${originalIndex}.${match[2]}`] = message
  }
  return remapped
}
