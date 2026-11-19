import React, { useMemo } from 'react'
import { AbsoluteFill, Img, staticFile } from 'remotion'
import { C, MONO, SANS } from './theme'
import { clamp, easeBack, easeInOut, easeOut, lerp, prog, seeded } from './anim'
import shotsJson from './shots.json'

export type Box = { x: number; y: number; w: number; h: number }
export const S = shotsJson as unknown as Record<string, { file: string; w: number; h: number; boxes: Record<string, Box | null> }>
export const bb = (shot: string, key: string): Box => S[shot].boxes[key] as Box
export const ctr = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/* ───────────── background stage ───────────── */
export const Stage: React.FC<{ t: number; children?: React.ReactNode; glow?: number }> = ({ t, children, glow = 1 }) => {
  const dots = useMemo(
    () => Array.from({ length: 56 }, (_, i) => ({ x: seeded('dx', i) * 1920, y: seeded('dy', i) * 1080, s: 2 + seeded('ds', i) * 3, ph: seeded('dp', i) * 6.28, sp: 0.3 + seeded('dv', i) * 0.7 })),
    [],
  )
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '120px 120px', backgroundPosition: `${-((t * 10) % 120)}px 0px`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 62% 45%, rgba(212,255,63,${0.075 * glow}), transparent 70%)` }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {dots.map((d, i) => (
          <rect key={i} x={d.x} y={(d.y - t * 6 * d.sp + 1080) % 1080} width={d.s} height={d.s} fill={C.lime} opacity={0.1 + 0.2 * (0.5 + 0.5 * Math.sin(t * d.sp + d.ph))} />
        ))}
      </svg>
      {children}
    </AbsoluteFill>
  )
}

/* ───────────── text ───────────── */
export const RevealLine: React.FC<{ t: number; t0: number; dur?: number; children: React.ReactNode; style?: React.CSSProperties; exitAt?: number }> = ({ t, t0, dur = 0.7, children, style, exitAt }) => {
  const p = prog(t, t0, t0 + dur, easeOut)
  const q = exitAt != null ? prog(t, exitAt, exitAt + 0.45, easeInOut) : 0
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.14em', marginBottom: '-0.14em', ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 112 + q * -112}%)`, opacity: p > 0 && q < 1 ? 1 : 0 }}>{children}</div>
    </div>
  )
}

export const Caption: React.FC<{ t: number; t0: number; exitAt?: number; x: number; y: number; w?: number; eyebrow?: string; lines: string[]; sub?: string; size?: number }> = ({ t, t0, exitAt, x, y, w = 520, eyebrow, lines, sub, size = 68 }) => {
  const fade = exitAt != null ? 1 - prog(t, exitAt, exitAt + 0.4, easeInOut) : 1
  if (t < t0 || fade <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, opacity: fade, fontFamily: SANS, color: C.text }}>
      {eyebrow && (
        <RevealLine t={t} t0={t0} style={{ marginBottom: 22 }}>
          <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>{eyebrow}</span>
        </RevealLine>
      )}
      {lines.map((l, i) => (
        <RevealLine key={i} t={t} t0={t0 + 0.08 + i * 0.1}>
          <div style={{ fontSize: size, fontWeight: 500, letterSpacing: '-0.045em', lineHeight: 1.02 }}>{l}</div>
        </RevealLine>
      ))}
      {sub && (
        <RevealLine t={t} t0={t0 + 0.3 + lines.length * 0.1} style={{ marginTop: 24 }}>
          <div style={{ fontSize: 28, lineHeight: 1.35, color: C.muted, letterSpacing: '-0.01em' }}>{sub}</div>
        </RevealLine>
      )}
    </div>
  )
}

export const Typed: React.FC<{ t: number; t0: number; t1: number; text: string }> = ({ t, t0, t1, text }) => {
  const p = clamp((t - t0) / (t1 - t0))
  return <>{text.slice(0, Math.round(text.length * p))}</>
}

export const Logo: React.FC<{ height: number; style?: React.CSSProperties }> = ({ height, style }) => (
  <Img src={staticFile('brand/logotype.png')} style={{ height, width: 'auto', filter: 'invert(1)', ...style }} />
)

/* ───────────── frames ───────────── */
type Layer = { shot: string; o?: number; clip?: string }
export const BrowserFrame: React.FC<{
  layers: Layer[]; left: number; top: number; width: number
  cam: { fx: number; fy: number; z: number }
  url?: string; chrome?: boolean; style?: React.CSSProperties
  overlay?: (k: number, scale: number) => React.ReactNode
}> = ({ layers, left, top, width, cam, url = 'tryvaivem.vercel.app', chrome = true, style, overlay }) => {
  const meta = S[layers[0].shot]
  const s0 = width / meta.w
  const contentH = meta.h * s0
  const scale = s0 * cam.z
  const tx = clamp(width / 2 - cam.fx * scale, width - meta.w * scale, 0)
  const ty = clamp(contentH / 2 - cam.fy * scale, contentH - meta.h * scale, 0)
  const k = 1 / scale
  const radius = chrome ? 16 : 0
  return (
    <div
      style={{
        position: 'absolute', left, top, width, borderRadius: radius, background: C.panel,
        border: chrome ? `1px solid ${C.line}` : 'none',
        boxShadow: chrome ? '0 60px 160px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02)' : 'none',
        ...style,
      }}
    >
      {chrome && (
        <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, borderBottom: `1px solid ${C.line}`, background: C.panel2, borderRadius: `${radius}px ${radius}px 0 0` }}>
          {['#3a3d42', '#3a3d42', '#3a3d42'].map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />)}
          <div style={{ margin: '0 auto', transform: 'translateX(-30px)', height: 26, padding: '0 16px', borderRadius: 7, background: '#0a0a0b', border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 13, color: C.muted }}>{url}</div>
        </div>
      )}
      <div style={{ position: 'relative', width, height: contentH, overflow: 'hidden', borderRadius: chrome ? `0 0 ${radius}px ${radius}px` : 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: meta.w, height: meta.h, transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: '0 0' }}>
          {layers.map((l, i) => (
            <Img key={i} src={staticFile(`shots/${S[l.shot].file}`)} style={{ position: 'absolute', left: 0, top: 0, width: meta.w, height: meta.h, opacity: l.o ?? 1, clipPath: l.clip }} />
          ))}
          {overlay?.(k, scale)}
        </div>
      </div>
    </div>
  )
}

export const PhoneFrame: React.FC<{ left: number; top: number; height: number; layers?: Layer[]; children?: React.ReactNode; overlay?: (k: number) => React.ReactNode; style?: React.CSSProperties }> = ({ left, top, height, layers, children, overlay, style }) => {
  const bez = 14
  const screenH = height - bez * 2
  const sp = screenH / 844
  const screenW = 390 * sp
  const width = screenW + bez * 2
  return (
    <div style={{ position: 'absolute', left, top, width, height, borderRadius: 64, background: '#050506', border: '2px solid #2a2c30', boxShadow: '0 70px 180px rgba(0,0,0,0.75), inset 0 0 0 2px #000, 0 0 0 1px rgba(255,255,255,0.05)', ...style }}>
      <div style={{ position: 'absolute', left: bez, top: bez, width: screenW, height: screenH, borderRadius: 50, overflow: 'hidden', background: C.bg }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${sp})`, transformOrigin: '0 0' }}>
          {layers?.map((l, i) => <Img key={i} src={staticFile(`shots/${S[l.shot].file}`)} style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, opacity: l.o ?? 1 }} />)}
          {children}
          {overlay?.(1 / sp)}
        </div>
      </div>
    </div>
  )
}

/* ───────────── pointer, ripple, highlight ───────────── */
export const Cursor: React.FC<{ x: number; y: number; k: number; press?: number; o?: number }> = ({ x, y, k, press = 0, o = 1 }) => (
  <svg width={34 * k} height={34 * k} viewBox="0 0 34 34" style={{ position: 'absolute', left: x - 2 * k, top: y - 2 * k, opacity: o, transform: `scale(${1 - 0.14 * press})`, transformOrigin: '2px 2px', filter: `drop-shadow(0 ${4 * k}px ${8 * k}px rgba(0,0,0,0.55))`, overflow: 'visible' }}>
    <path d="M2 2 L2 25 L8 19.6 L12.2 29 L16 27.2 L11.9 18 L20 18 Z" fill="#fff" stroke="#0a0a0b" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
)

export const Touch: React.FC<{ x: number; y: number; k: number; press?: number; o?: number }> = ({ x, y, k, press = 0, o = 1 }) => (
  <div style={{ position: 'absolute', left: x - 22 * k, top: y - 22 * k, width: 44 * k, height: 44 * k, borderRadius: 44 * k, background: 'rgba(255,255,255,0.28)', border: `${2 * k}px solid rgba(255,255,255,0.7)`, opacity: o, transform: `scale(${1 - 0.18 * press})`, boxShadow: `0 ${6 * k}px ${18 * k}px rgba(0,0,0,0.4)` }} />
)

export const Ripple: React.FC<{ x: number; y: number; k: number; t: number; t0: number; color?: string }> = ({ x, y, k, t, t0, color = C.lime }) => {
  const p = (t - t0) / 0.7
  if (p < 0 || p > 1) return null
  return (
    <>
      {[0, 0.18].map((d, i) => {
        const q = clamp(p - d)
        if (q <= 0) return null
        const r = (14 + easeOut(q) * 70) * k
        return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, border: `${3 * k}px solid ${color}`, opacity: (1 - q) * 0.9 }} />
      })}
    </>
  )
}

export const Highlight: React.FC<{ box: Box; t: number; t0: number; t1: number; k: number; label?: string; pad?: number; dim?: number; below?: boolean; radius?: number }> = ({ box, t, t0, t1, k, label, pad = 8, dim = 0.5, below = false, radius = 10 }) => {
  const pin = prog(t, t0, t0 + 0.5, easeOut)
  const pout = prog(t, t1 - 0.35, t1, easeInOut)
  const a = pin * (1 - pout)
  if (a <= 0.001) return null
  const x = box.x - pad * k, y = box.y - pad * k, w = box.w + pad * 2 * k, h = box.h + pad * 2 * k
  const per = 2 * (w + h)
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: radius * k, boxShadow: `0 0 0 6000px rgba(6,6,7,${dim * a})`, pointerEvents: 'none' }} />
      <svg style={{ position: 'absolute', left: x - 4 * k, top: y - 4 * k, overflow: 'visible' }} width={w + 8 * k} height={h + 8 * k}>
        <rect x={4 * k} y={4 * k} width={w} height={h} rx={radius * k} fill="none" stroke={C.lime} strokeWidth={2.5 * k} strokeDasharray={per} strokeDashoffset={per * (1 - pin)} opacity={1 - pout} style={{ filter: `drop-shadow(0 0 ${10 * k}px rgba(212,255,63,0.5))` }} />
      </svg>
      {label && (
        <div style={{ position: 'absolute', left: x, [below ? 'top' : 'bottom']: below ? y + h + 12 * k : undefined, top: below ? y + h + 12 * k : y - 46 * k, opacity: a, transform: `translateY(${(1 - pin) * 10 * k}px)`, padding: `${7 * k}px ${12 * k}px`, background: C.lime, color: '#0a0a0b', fontFamily: MONO, fontSize: 16 * k, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap', borderRadius: 4 * k }}>
          {label}
        </div>
      )}
    </>
  )
}

export const Burst: React.FC<{ cx: number; cy: number; t: number; t0: number; n?: number; r?: number }> = ({ cx, cy, t, t0, n = 40, r = 460 }) => {
  const p = (t - t0) / 1.1
  if (p < 0 || p > 1) return null
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const ang = seeded('ba', i) * Math.PI * 2
        const d = (0.35 + seeded('bd', i) * 0.65) * r * easeOut(p)
        const s = 5 + seeded('bs', i) * 11
        return <div key={i} style={{ position: 'absolute', left: cx + Math.cos(ang) * d - s / 2, top: cy + Math.sin(ang) * d - s / 2, width: s, height: s, background: i % 4 === 0 ? '#fff' : C.lime, opacity: (1 - p) * 0.95, transform: `rotate(${p * 160 * (i % 2 ? 1 : -1)}deg)` }} />
      })}
    </>
  )
}
