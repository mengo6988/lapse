/**
 * Wire types for `/api/bootstrap`, per docs/spec.md § API and
 * src/server/routes/bootstrap.ts. Defined independently of the server's
 * Drizzle-inferred row types rather than importing them, so the client
 * describes what it actually receives over HTTP, not the server's internals.
 *
 * The bootstrap response is external data, so it gets a light Zod parse at
 * the boundary (shape and primitive types only — business rules like string
 * length limits are the server's job, already enforced before the row ever
 * reaches this payload).
 */
import { z } from 'zod'

const entrySchema = z.object({
  id: z.string(),
  trackerId: z.string(),
  variantId: z.string().nullable(),
  occurredAt: z.string(),
  durationMinutes: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
})

const variantSchema = z.object({
  id: z.string(),
  name: z.string(),
  thresholdDays: z.number().nullable(),
  latestEntry: entrySchema.nullable(),
})

const trackerSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().nullable(),
  thresholdDays: z.number().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  latestEntry: entrySchema.nullable(),
  variants: z.array(variantSchema),
})

export const bootstrapPayloadSchema = z.object({
  categories: z.array(categorySchema),
  trackers: z.array(trackerSchema),
})

export type Entry = z.infer<typeof entrySchema>
export type Category = z.infer<typeof categorySchema>
export type Variant = z.infer<typeof variantSchema>
export type Tracker = z.infer<typeof trackerSchema>
export type BootstrapPayload = z.infer<typeof bootstrapPayloadSchema>
