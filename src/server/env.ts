import { z } from 'zod'

/**
 * Boot step 1 per docs/tech-stack.md § Boot sequence. LAPSE_PASSWORD is
 * required and non-empty: an unset password must stop the boot, never open the
 * app (ADR-0003 amendment — this deployment is public).
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATA_DIR: z.string().min(1).default('/data'),
  LAPSE_PASSWORD: z.string().min(1, 'LAPSE_PASSWORD must be set and non-empty'),
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
