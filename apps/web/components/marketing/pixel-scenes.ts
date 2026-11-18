import type { Scene } from '@/components/marketing/pixel-field'
import { pixelFont } from '@/components/marketing/pixel-font'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Thins a scene toward the bottom so it dissolves like a halftone print. */
export function fade(scene: Scene, { from = 0.5, floor = 0.08 }: { from?: number; floor?: number } = {}): Scene {
  return (ctx, cols, rows) => {
    scene(ctx, cols, rows)
    const img = ctx.getImageData(0, 0, cols, rows)
    const d = img.data
    const rand = mulberry32(99)
    for (let y = 0; y < rows; y++) {
      const keep = 1 - (1 - floor) * smooth((y / rows - from) / (1 - from))
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4 + 3
        if (d[i]! > 120 && rand() > keep) d[i] = 0
      }
    }
    ctx.putImageData(img, 0, 0)
  }
}

/**
 * Large word rendered as dots, fitted to the field width.
 * With `zone` (an element id) it also stays inside that element's vertical band.
 */
export function wordScene(
  text: string,
  { fill = 0.94, zone, weight = 600 }: { fill?: number; zone?: string; weight?: number } = {},
): Scene {
  return (ctx, cols, rows) => {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = pixelFont(100, weight)
    const w100 = ctx.measureText(text).width || 1
    let maxSize = rows * 0.8
    let baseline = rows * 0.92
    const el = zone && typeof document !== 'undefined' ? document.getElementById(zone) : null
    const host = el?.closest('section')?.querySelector('canvas')?.parentElement
    if (el && host) {
      const zr = el.getBoundingClientRect()
      const hr = host.getBoundingClientRect()
      const k = rows / Math.max(1, hr.height)
      const top = (zr.top - hr.top) * k
      const bottom = (zr.bottom - hr.top) * k
      maxSize = Math.max(4, (bottom - top) / 0.8)
      baseline = bottom - (bottom - top) * 0.06
    }
    const size = Math.min((100 * cols * fill) / w100, maxSize)
    ctx.font = pixelFont(size, weight)
    const w = ctx.measureText(text).width
    ctx.fillText(text, (cols - w) / 2, baseline)
  }
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, h / 2)
  else ctx.rect(x, y, w, h)
  ctx.stroke()
}

/** Step 1 — the money. */
export const coinScene: Scene = fade(
  (ctx, cols, rows) => {
    const r = Math.min(cols, rows) * 0.38
    ctx.lineWidth = 2.3
    ctx.beginPath()
    ctx.arc(cols / 2, rows / 2, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cols / 2, rows / 2, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = pixelFont(r * 1.1, 500)
    ctx.fillText('$', cols / 2, rows / 2 + r * 0.05)
  },
  { from: 0.62 },
)

/** Step 2 — the link. */
export const linkScene: Scene = fade(
  (ctx, cols, rows) => {
    const s = Math.min(cols, rows)
    ctx.lineWidth = 2.5
    ctx.translate(cols / 2, rows / 2)
    ctx.rotate(-Math.PI / 4)
    const w = s * 0.5
    const h = s * 0.25
    pill(ctx, -w * 0.78, -h / 2, w, h)
    pill(ctx, -w * 0.22, -h / 2, w, h)
  },
  { from: 0.62 },
)

/** Step 3 — PIX landing in a bank account. */
export const pixScene: Scene = fade(
  (ctx, cols, rows) => {
    const s = Math.min(cols, rows)
    const a = s * 0.27
    ctx.save()
    ctx.translate(cols / 2, rows / 2)
    ctx.rotate(Math.PI / 4)
    ctx.lineWidth = 2.5
    ctx.strokeRect(-a, -a, a * 2, a * 2)
    ctx.lineWidth = 1.2
    ctx.strokeRect(-a * 0.72, -a * 0.72, a * 1.44, a * 1.44)
    ctx.restore()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = pixelFont(s * 0.17, 500)
    ctx.fillText('R$', cols / 2, rows / 2 + s * 0.01)
  },
  { from: 0.62 },
)
