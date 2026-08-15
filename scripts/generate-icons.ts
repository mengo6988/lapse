/**
 * Rasterizes src/client/public/icons/icon.svg into the committed PNG set
 * (docs/design.md § App icon). Re-run after editing the SVG source:
 *
 *   npx tsx scripts/generate-icons.ts
 *
 * The 512 "any" and 512 "maskable" outputs are pixel-identical — the source
 * SVG already keeps the glyph inside the maskable safe zone, so one design
 * serves both manifest purposes (docs/tech-stack.md PWA row).
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(here, '../src/client/public/icons')
const svgPath = resolve(iconsDir, 'icon.svg')

interface IconTarget {
  file: string
  size: number
}

const targets: IconTarget[] = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-512-maskable.png', size: 512 },
  { file: 'apple-touch-icon-180.png', size: 180 },
]

async function main(): Promise<void> {
  const svg = await readFile(svgPath)

  for (const target of targets) {
    const outPath = resolve(iconsDir, target.file)
    await sharp(svg, { density: 384 })
      .resize(target.size, target.size)
      // iOS expects a fully opaque icon; flatten drops the alpha channel
      // rather than relying on the SVG background being opaque everywhere.
      .flatten({ background: '#1e1e2e' })
      .png()
      .toFile(outPath)
    console.log(`wrote ${target.file} (${target.size}x${target.size})`)
  }
}

main().catch((error: unknown) => {
  console.error('icon generation failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
