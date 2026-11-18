'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion, type MotionValue } from 'framer-motion'
import { pixelFont } from '@/components/marketing/pixel-font'

/** Draws a shape in cell units onto a (cols × rows) canvas; opaque pixels become particles. */
export type Scene = (ctx: CanvasRenderingContext2D, cols: number, rows: number) => void

type Props = {
  scenes: Scene[]
  /** Continuous scene index, 0 … scenes.length-1. Omit for a single static scene. */
  progress?: MotionValue<number>
  cell?: number
  color: string
  accent?: string
  accentEvery?: number
  /** 'wave' makes the field drift left and right (vai e vem). */
  idle?: 'wave' | 'none'
  radius?: number
  scatter?: number
  maxParticles?: number
  className?: string
  label: string
}

/**
 * One grid of square particles that morphs between scenes as `progress` changes
 * and is pushed around by the pointer. Runs only while on screen.
 */
export function PixelField({
  scenes,
  progress,
  cell = 8,
  color,
  accent,
  accentEvery = 9,
  idle = 'none',
  radius = 9,
  scatter = 7,
  maxParticles = 4200,
  className,
  label,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true
    let visible = true
    let raf = 0
    let buildId = 0
    let cols = 0
    let rows = 0
    let dpr = 1
    let n = 0
    let cur = progress ? progress.get() : 0
    let targets: Float32Array[] = []
    let ox = new Float32Array(0)
    let oy = new Float32Array(0)
    let vx = new Float32Array(0)
    let vy = new Float32Array(0)
    let rx = new Float32Array(0)
    let ry = new Float32Array(0)
    let px = new Float32Array(0)
    let py = new Float32Array(0)
    const ptr = { x: -999, y: -999 }
    const S = scenes.length

    const draw = (time: number, animate: boolean) => {
      if (!n) return
      const target = progress ? Math.min(S - 1, Math.max(0, progress.get())) : 0
      cur += (target - cur) * (animate ? 0.14 : 1)
      const k = S > 1 ? Math.min(S - 2, Math.floor(cur)) : 0
      const f = S > 1 ? cur - k : 0
      const e = f * f * (3 - 2 * f)
      const a = targets[k]!
      const b = targets[Math.min(S - 1, k + 1)]!
      const amp = scatter * Math.sin(Math.PI * e)
      const r2 = radius * radius
      const wave = idle === 'wave' && animate && !reduce

      for (let i = 0; i < n; i++) {
        const ax = a[i * 2]!
        const ay = a[i * 2 + 1]!
        let x = ax + (b[i * 2]! - ax) * e + rx[i]! * amp
        const y = ay + (b[i * 2 + 1]! - ay) * e + ry[i]! * amp
        if (wave) x += Math.sin(time * 1.3 + y * 0.16) * 1.6 * (1 - e)
        if (animate) {
          const dx = x + ox[i]! - ptr.x
          const dy = y + oy[i]! - ptr.y
          const d2 = dx * dx + dy * dy
          if (d2 < r2 && d2 > 0.0001) {
            const d = Math.sqrt(d2)
            const fr = (1 - d / radius) * 1.7
            vx[i]! += (dx / d) * fr
            vy[i]! += (dy / d) * fr
          }
          vx[i] = (vx[i]! - ox[i]! * 0.05) * 0.84
          vy[i] = (vy[i]! - oy[i]! * 0.05) * 0.84
          ox[i]! += vx[i]!
          oy[i]! += vy[i]!
        }
        px[i] = (x + ox[i]!) * cell
        py[i] = (y + oy[i]!) * cell
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      const size = cell > 5 ? cell - 1 : cell
      ctx.fillStyle = color
      for (let i = 0; i < n; i++) {
        if (accent && i % accentEvery === 0) continue
        ctx.fillRect(px[i]!, py[i]!, size, size)
      }
      if (accent) {
        ctx.fillStyle = accent
        for (let i = 0; i < n; i += accentEvery) ctx.fillRect(px[i]!, py[i]!, size, size)
      }
    }

    const build = async () => {
      const id = ++buildId
      try {
        await document.fonts.load(pixelFont(20))
        await document.fonts.ready
      } catch {
        /* fall back to the system monospace */
      }
      if (!alive || id !== buildId) return
      const rect = host.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      cols = Math.max(8, Math.floor(w / cell))
      rows = Math.max(8, Math.floor(h / cell))

      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const octx = off.getContext('2d', { willReadFrequently: true })
      if (!octx) return
      const lists: [number, number][][] = []
      for (const scene of scenes) {
        octx.clearRect(0, 0, cols, rows)
        octx.save()
        octx.fillStyle = '#000'
        octx.strokeStyle = '#000'
        scene(octx, cols, rows)
        octx.restore()
        const d = octx.getImageData(0, 0, cols, rows).data
        const pts: [number, number][] = []
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (d[(y * cols + x) * 4 + 3]! > 120) pts.push([x, y])
          }
        }
        pts.sort((p, q) => p[0] - q[0] || p[1] - q[1])
        lists.push(pts)
      }

      n = Math.min(maxParticles, Math.max(1, ...lists.map((l) => l.length)))
      targets = lists.map((pts) => {
        const t = new Float32Array(n * 2)
        for (let i = 0; i < n; i++) {
          if (!pts.length) {
            t[i * 2] = -20
            t[i * 2 + 1] = -20
            continue
          }
          const p = pts[Math.min(pts.length - 1, Math.floor((i * pts.length) / n))]!
          t[i * 2] = p[0]
          t[i * 2 + 1] = p[1]
        }
        return t
      })
      ox = new Float32Array(n)
      oy = new Float32Array(n)
      vx = new Float32Array(n)
      vy = new Float32Array(n)
      px = new Float32Array(n)
      py = new Float32Array(n)
      rx = Float32Array.from({ length: n }, () => Math.random() * 2 - 1)
      ry = Float32Array.from({ length: n }, () => Math.random() * 2 - 1)
      draw(0, false)
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden) return
      draw(t / 1000, true)
    }

    const onMove = (ev: PointerEvent) => {
      const r = host.getBoundingClientRect()
      ptr.x = (ev.clientX - r.left) / cell
      ptr.y = (ev.clientY - r.top) / cell
    }
    const onLeave = () => {
      ptr.x = -999
      ptr.y = -999
    }

    void build()
    let resizeTimer = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => void build(), 160)
    })
    ro.observe(host)
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
    })
    io.observe(host)

    let unsub: (() => void) | undefined
    if (reduce) {
      unsub = progress?.on('change', () => draw(0, false))
    } else {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      ro.disconnect()
      io.disconnect()
      unsub?.()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
    // scenes/progress are stable module-level or memoised by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, color, accent, accentEvery, idle, radius, scatter, maxParticles, reduce])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={`absolute inset-0 h-full w-full ${className ?? ''}`}
    />
  )
}
