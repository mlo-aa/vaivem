'use client'

import { useEffect, useRef } from 'react'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'

const SIZE = 64
const NOISE = (() => {
  let a = 1234567
  const arr = new Float32Array(SIZE * SIZE)
  for (let i = 0; i < arr.length; i++) {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    arr[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return arr
})()

/**
 * A band where one section dissolves into the next as scattered pixels.
 * The threshold sweeps with scroll so the dissolve plays as you pass it.
 */
export function DitherDivider({
  from,
  to,
  rows = 16,
  cell = 8,
}: {
  from: string
  to: string
  rows?: number
  cell?: number
}) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: host, offset: ['start end', 'end start'] })

  const paint = (sweep: number) => {
    const c = canvas.current
    const h = host.current
    if (!c || !h) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const w = h.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(rows * cell * dpr)) {
      c.width = Math.floor(w * dpr)
      c.height = Math.floor(rows * cell * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = from
    ctx.fillRect(0, 0, w, rows * cell)
    ctx.fillStyle = to
    const cols = Math.ceil(w / cell)
    const shift = reduce ? 0 : (sweep - 0.5) * 0.7
    for (let y = 0; y < rows; y++) {
      const g = (y + 0.5) / rows + shift
      for (let x = 0; x < cols; x++) {
        if (g > NOISE[(y % SIZE) * SIZE + (x % SIZE)]!) ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1)
      }
    }
  }

  useEffect(() => {
    paint(scrollYProgress.get())
    const onResize = () => paint(scrollYProgress.get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, rows, cell])

  useMotionValueEvent(scrollYProgress, 'change', (v) => paint(v))

  return (
    <div ref={host} aria-hidden style={{ height: rows * cell, background: from }} className="w-full overflow-hidden">
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  )
}
