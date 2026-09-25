// Генерирует PNG-иконки PWA («Ночной дневник»: чернильный фон, лунный серп
// и абрикосовая звезда) без внешних зависимостей:
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
// Всё значимое — внутри безопасной зоны maskable-иконки (центральные 80%).
const BG = [29, 35, 64] // #1d2340 — чернила
const MOON = [255, 244, 214] // #fff4d6 — луна
const STAR = [224, 138, 94] // #e08a5e — абрикос
const moon = { cx: 0.47, cy: 0.54, r: 0.25 }
const cut = { cx: 0.56, cy: 0.46, r: 0.215 }
// Четырёхлучевая звезда: |dx|^p + |dy|^p <= r^p при p < 1 даёт вогнутые лучи
const star = { cx: 0.68, cy: 0.3, r: 0.1, p: 0.55 }

function sampleColor(nx, ny) {
  let c = BG
  const dMoon = Math.hypot(nx - moon.cx, ny - moon.cy)
  const dCut = Math.hypot(nx - cut.cx, ny - cut.cy)
  if (dMoon <= moon.r && dCut > cut.r) c = MOON
  const sx = Math.abs(nx - star.cx), sy = Math.abs(ny - star.cy)
  if (sx ** star.p + sy ** star.p <= star.r ** star.p) c = STAR
  return c
}

function render(size) {
  const ss = 4 // суперсэмплинг для сглаживания краёв
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
