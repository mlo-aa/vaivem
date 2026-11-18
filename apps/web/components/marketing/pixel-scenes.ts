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

/**
 * Big pixel word, fitted to the width of the field. With `zone` (an element id),
 * the word is also fitted inside that element's vertical band, so layout text
 * above it is never covered.
 */
export function wordScene(
  text: string,
  { anchor = 'bottom', fill = 0.94, zone }: { anchor?: 'bottom' | 'center'; fill?: number; zone?: string } = {},
): Scene {
  return (ctx, cols, rows) => {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = pixelFont(100)
    const w100 = ctx.measureText(text).width || 1
    let maxSize = rows * 0.8
    let baseline = anchor === 'bottom' ? rows * 0.97 : rows / 2
    const el = zone && typeof document !== 'undefined' ? document.getElementById(zone) : null
    const host = el?.parentElement?.querySelector('canvas')?.parentElement
    if (el && host) {
      const zr = el.getBoundingClientRect()
      const hr = host.getBoundingClientRect()
      const k = rows / Math.max(1, hr.height)
      const top = (zr.top - hr.top) * k
      const bottom = (zr.bottom - hr.top) * k
      maxSize = Math.max(4, (bottom - top) / 0.8)
      baseline = bottom - (bottom - top) * 0.05
    }
    const size = Math.min((100 * cols * fill) / w100, maxSize)
    ctx.font = pixelFont(size)
    const w = ctx.measureText(text).width
    const y = anchor === 'bottom' || el ? baseline : baseline + size * 0.36
    ctx.fillText(text, (cols - w) / 2, y)
  }
}

/** Scattered pixels, denser toward the bottom (the wordmark dissolving). */
export const dustScene: Scene = (ctx, cols, rows) => {
  const rand = mulberry32(7)
  for (let y = 0; y < rows; y++) {
    const p = 0.01 + 0.34 * Math.pow(y / rows, 2.2)
    for (let x = 0; x < cols; x++) {
      if (rand() < p) ctx.fillRect(x, y, 1, 1)
    }
  }
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, h / 2)
  else ctx.rect(x, y, w, h)
  ctx.stroke()
}

/** Step 1 — the money: a coin. */
export const coinScene: Scene = (ctx, cols, rows) => {
  const s = Math.min(cols, rows)
  const r = s * 0.38
  ctx.lineWidth = Math.max(2, r * 0.15)
  ctx.beginPath()
  ctx.arc(cols / 2, rows / 2, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = Math.max(1, r * 0.05)
  ctx.beginPath()
  ctx.arc(cols / 2, rows / 2, r * 0.78, 0, Math.PI * 2)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = pixelFont(r * 1.2)
  ctx.fillText('$', cols / 2, rows / 2 + r * 0.06)
}

/** Step 2 — the link. */
export const linkScene: Scene = (ctx, cols, rows) => {
  const s = Math.min(cols, rows)
  ctx.lineWidth = Math.max(2.5, s * 0.075)
  ctx.translate(cols / 2, rows / 2)
  ctx.rotate(-Math.PI / 4)
  const w = s * 0.5
  const h = s * 0.25
  pill(ctx, -w * 0.78, -h / 2, w, h)
  pill(ctx, -w * 0.22, -h / 2, w, h)
}

/** Step 3 — PIX landing in a bank account: a diamond with R$. */
export const pixScene: Scene = (ctx, cols, rows) => {
  const s = Math.min(cols, rows)
  const a = s * 0.27
  ctx.save()
  ctx.translate(cols / 2, rows / 2)
  ctx.rotate(Math.PI / 4)
  ctx.lineWidth = Math.max(2.5, s * 0.07)
  ctx.strokeRect(-a, -a, a * 2, a * 2)
  ctx.lineWidth = Math.max(1, s * 0.025)
  ctx.strokeRect(-a * 0.72, -a * 0.72, a * 1.44, a * 1.44)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = pixelFont(s * 0.2)
  ctx.fillText('R$', cols / 2, rows / 2 + s * 0.01)
}
