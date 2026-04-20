/**
 * Generates build/icon.png (1024×1024), build/icon.icns (macOS),
 * and build/icon.ico (Windows) from build/icon.svg
 *
 * Run with: node scripts/create-icons.mjs
 */

import sharp from 'sharp'
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const buildDir = path.join(root, 'build')

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true })

const svgPath  = path.join(buildDir, 'icon.svg')
const pngPath  = path.join(buildDir, 'icon.png')
const icnsPath = path.join(buildDir, 'icon.icns')
const icoPath  = path.join(buildDir, 'icon.ico')

// ── 1. SVG → PNG 1024×1024 ───────────────────────────────────────────────────
console.log('Generating icon.png …')
await sharp(svgPath)
  .resize(1024, 1024)
  .png()
  .toFile(pngPath)
console.log('  ✓ build/icon.png')

// ── 2. PNG → ICNS (macOS) ────────────────────────────────────────────────────
//    Uses macOS built-in `iconutil`. Falls back gracefully on non-Mac.
if (process.platform === 'darwin') {
  console.log('Generating icon.icns …')
  const iconsetDir = path.join(buildDir, 'icon.iconset')
  if (!existsSync(iconsetDir)) mkdirSync(iconsetDir)

  const sizes = [16, 32, 64, 128, 256, 512, 1024]
  for (const size of sizes) {
    await sharp(pngPath).resize(size, size).png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`))
    // @2x version (retina) — only needed up to 512
    if (size <= 512) {
      await sharp(pngPath).resize(size * 2, size * 2).png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`))
    }
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`)
  execSync(`rm -rf "${iconsetDir}"`)
  console.log('  ✓ build/icon.icns')
} else {
  console.log('  ⚠ Skipping .icns — only generated on macOS')
}

// ── 3. PNG → ICO (Windows) ───────────────────────────────────────────────────
//    Builds a multi-resolution .ico by stacking 16/32/48/64/128/256 PNGs.
console.log('Generating icon.ico …')
const icoSizes = [16, 32, 48, 64, 128, 256]
const pngBuffers = await Promise.all(
  icoSizes.map(s => sharp(pngPath).resize(s, s).png().toBuffer())
)

// Minimal ICO writer (ICONDIR + ICONDIRENTRY[] + image data)
function buildIco(pngs) {
  const count = pngs.length
  const headerSize = 6
  const entrySize  = 16
  const dataOffset = headerSize + entrySize * count

  // Calculate total size
  const totalSize = dataOffset + pngs.reduce((s, b) => s + b.length, 0)
  const buf = Buffer.alloc(totalSize)

  // ICONDIR header
  buf.writeUInt16LE(0,     0) // reserved
  buf.writeUInt16LE(1,     2) // type: 1 = ICO
  buf.writeUInt16LE(count, 4)

  let dataPos = dataOffset
  pngs.forEach((png, i) => {
    const s = icoSizes[i]
    const entry = headerSize + i * entrySize
    buf.writeUInt8(s >= 256 ? 0 : s,  entry)     // width  (0 = 256)
    buf.writeUInt8(s >= 256 ? 0 : s,  entry + 1) // height
    buf.writeUInt8(0,  entry + 2)  // color count
    buf.writeUInt8(0,  entry + 3)  // reserved
    buf.writeUInt16LE(1, entry + 4) // planes
    buf.writeUInt16LE(32,entry + 6) // bit count
    buf.writeUInt32LE(png.length,  entry + 8)
    buf.writeUInt32LE(dataPos,     entry + 12)
    png.copy(buf, dataPos)
    dataPos += png.length
  })

  return buf
}

import { writeFileSync } from 'fs'
writeFileSync(icoPath, buildIco(pngBuffers))
console.log('  ✓ build/icon.ico')

console.log('\nAll icons generated successfully!')
