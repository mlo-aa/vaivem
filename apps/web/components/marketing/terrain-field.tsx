'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion, type MotionValue } from 'framer-motion'

/** Far → near. Ridges climb from left to right; nearer layers are brighter and parallax more. */
type Layer = {
  l: number // ridge height (fraction of the field) at the left edge
  r: number // … at the right edge
  amp: number
  freq: number
  depth: number // how far below the crest the layer stays lit
  gain: number // peak brightness
  seed: number
  lag: number // scroll parallax (fraction of the field)
  speed: number // horizontal scroll drift
}

const LAYERS: Layer[] = [
  { l: 0.74, r: 0.34, amp: 0.3, freq: 2.4, depth: 0.2, gain: 0.52, seed: 3, lag: 0.22, speed: 0.04 },
  { l: 0.82, r: 0.46, amp: 0.32, freq: 3.2, depth: 0.19, gain: 0.7, seed: 8, lag: 0.15, speed: 0.09 },
  { l: 0.91, r: 0.6, amp: 0.3, freq: 4.0, depth: 0.17, gain: 0.88, seed: 15, lag: 0.08, speed: 0.17 },
  { l: 1.0, r: 0.78, amp: 0.22, freq: 5.2, depth: 0.15, gain: 1, seed: 21, lag: 0.02, speed: 0.3 },
]

// [bright, mid, dim, sun]
const COLORS = ['#d4ff3f', '#9cc02a', '#566d1a', '#f1ffb5']

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

function valueNoise(seed: number) {
  const rand = mulberry32(seed)
  const table = Float32Array.from({ length: 256 }, () => rand())
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const a = table[i & 255]!
    const b = table[(i + 1) & 255]!
    const u = f * f * (3 - 2 * f)
    return a + (b - a) * u
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3)

/**
 * A halftone mountain range: layered ridges, a rising sun and a few stars, all
 * drawn as dots. Scroll shifts the layers at different speeds; the pointer
 * pushes dots aside. Drawing stops while off screen.
 */
export function TerrainField({
  progress,
  cell = 7,
  className,
}: {
  progress?: MotionValue<number>
  cell?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !host || !ctx) return

    const noises = LAYERS.map((l) => valueNoise(l.seed))
    const dither = (() => {
      const rand = mulberry32(4242)
      return Float32Array.from({ length: 64 * 64 }, () => rand())
    })()
    const fbm = (n: (x: number) => number, x: number) =>
      n(x) * 0.55 + n(x * 2.1 + 7) * 0.28 + n(x * 4.3 + 13) * 0.17

    let alive = true
    let visible = true
    let raf = 0
    let last = 0
    let cols = 0
    let rows = 0
    let dpr = 1
    let ridges: Float32Array[] = []
    let xs: Float32Array[] = []
    let ys: Float32Array[] = []
    const counts = [0, 0, 0, 0]
    const ptr = { x: -9999, y: -9999 }
    const startedAt = performance.now()
    const slow = window.innerWidth < 640
    const frameGap = slow ? 34 : 16

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      cols = Math.ceil(w / cell)
      rows = Math.ceil(h / cell)
      ridges = LAYERS.map(() => new Float32Array(cols))
      xs = COLORS.map(() => new Float32Array(cols * rows))
      ys = COLORS.map(() => new Float32Array(cols * rows))
    }

    const draw = (now: number, animate: boolean) => {
      if (!cols) return
      const t = (now - startedAt) / 1000
      const intro = animate ? easeOut(clamp01(t / 1.9)) : 1
      const prog = progress ? clamp01(progress.get()) : 0

      for (let k = 0; k < LAYERS.length; k++) {
        const L = LAYERS[k]!
        const arr = ridges[k]!
        for (let cx = 0; cx < cols; cx++) {
          const u = cx / cols
          const n = fbm(noises[k]!, u * L.freq + prog * L.speed * 3 + (animate ? t * 0.012 * (k + 1) : 0))
          const frac =
            L.l + (L.r - L.l) * u + (n - 0.5) * L.amp + (1 - intro) * (0.42 + 0.1 * k) + prog * L.lag
          arr[cx] = frac * rows
        }
      }

      const sunX = cols * 0.68
      const sunY = rows * 0.34 + (1 - intro) * rows * 0.55 + prog * rows * 0.12
      const sunR = 0.17 * Math.min(cols, rows * 1.3)
      counts.fill(0)

      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          let owner = -1
          for (let k = LAYERS.length - 1; k >= 0; k--) {
            if (cy >= ridges[k]![cx]!) {
              owner = k
              break
            }
          }
          const nz = dither[(cy & 63) * 64 + (cx & 63)]!
          let g = 0
          let bucket = 0
          if (owner >= 0) {
            const L = LAYERS[owner]!
            const d = cy - ridges[owner]![cx]!
            const f = 1 - d / (L.depth * rows)
            g = f > 0 ? L.gain * Math.pow(f, 1.15) : 0
            if (d < 1.6) g = Math.min(1, L.gain + 0.15)
            bucket = g > 0.7 ? 0 : g > 0.4 ? 1 : 2
          } else {
            const d = Math.hypot(cx - sunX, cy - sunY) / sunR
            if (d < 1) {
              g = 0.4 + 0.6 * (1 - d * d)
              bucket = d < 0.55 ? 3 : 0
            } else if (d < 1.7) {
              g = (0.3 * (1.7 - d)) / 0.7
              bucket = 2
            } else {
              const h = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0
              const r = (h % 100000) / 100000
              if (r < 0.006 && (!animate || Math.sin(t * 1.3 + r * 9000) > -0.3)) {
                g = 1
                bucket = 2
              }
            }
          }
          if (g > nz * 0.92) {
            let px = cx * cell
            let py = cy * cell
            if (animate) {
              const dx = px + cell / 2 - ptr.x
              const dy = py + cell / 2 - ptr.y
              const d2 = dx * dx + dy * dy
              if (d2 < 9000 && d2 > 1) {
                const d = Math.sqrt(d2)
                const push = (1 - d / 95) * 16
                px += (dx / d) * push
                py += (dy / d) * push
              }
            }
            const i = counts[bucket]!++
            xs[bucket]![i] = px
            ys[bucket]![i] = py
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      const size = Math.max(1.5, cell * 0.6)
      const inset = (cell - size) / 2
      for (let b = 0; b < COLORS.length; b++) {
        ctx.fillStyle = COLORS[b]!
        const bx = xs[b]!
        const by = ys[b]!
        for (let i = 0; i < counts[b]!; i++) ctx.fillRect(bx[i]! + inset, by[i]! + inset, size, size)
      }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden || now - last < frameGap) return
      last = now
      draw(now, true)
    }

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      ptr.x = e.clientX - r.left
      ptr.y = e.clientY - r.top
    }
    const onLeave = () => {
      ptr.x = -9999
      ptr.y = -9999
    }

    resize()
    let resizeTimer = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resize()
        if (reduce) draw(performance.now(), false)
      }, 140)
    })
    ro.observe(host)
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting)
    })
    io.observe(host)

    let unsub: (() => void) | undefined
    if (reduce) {
      draw(performance.now(), false)
      unsub = progress?.on('change', () => draw(performance.now(), false))
    } else {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      alive = false
      void alive
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      ro.disconnect()
      io.disconnect()
      unsub?.()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, reduce])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label=""
      aria-hidden
      className={`absolute inset-0 h-full w-full ${className ?? ''}`}
    />
  )
}
