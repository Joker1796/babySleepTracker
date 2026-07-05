// Генерирует PNG-иконки PWA (луна со звёздами) без внешних зависимостей:
// рисует пиксели математикой и кодирует PNG вручную через node:zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // бит на канал
  ihdr[9] = 6 // RGBA
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // фильтр none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// Дизайн иконки в относительных координатах (0..1)
const BG_TOP = [109, 106, 240]
const BG_BOTTOM = [68, 56, 184]
const MOON = [255, 244, 214]
const STAR = [255, 255, 255]
const moon = { cx: 0.57, cy: 0.52, r: 0.28 }
const cut = { cx: 0.47, cy: 0.43, r: 0.245 }
const stars = [
  [0.3, 0.27, 0.028],
  [0.23, 0.58, 0.02],
  [0.71, 0.8, 0.022],
  [0.79, 0.28, 0.016]
]

function sampleColor(nx, ny) {
  const t = ny
  let c = [
    BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
    BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
    BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t
  ]
  const dMoon = Math.hypot(nx - moon.cx, ny - moon.cy)
  const dCut = Math.hypot(nx - cut.cx, ny - cut.cy)
  if (dMoon <= moon.r && dCut > cut.r) c = MOON
  for (const [sx, sy, sr] of stars) {
    if (Math.hypot(nx - sx, ny - sy) <= sr) c = STAR
  }
  return c
}

function render(size) {
  const ss = 2 // суперсэмплинг для сглаживания краёв
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sampleColor((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
          r += c[0]; g += c[1]; b += c[2]
        }
      }
      const i = (y * size + x) * 4
      rgba[i] = r / (ss * ss)
      rgba[i + 1] = g / (ss * ss)
      rgba[i + 2] = b / (ss * ss)
      rgba[i + 3] = 255
    }
  }
  return rgba
}

for (const size of [180, 192, 512]) {
  const file = join(outDir, `icon-${size}.png`)
  writeFileSync(file, encodePng(size, render(size)))
  console.log('written', file)
}
