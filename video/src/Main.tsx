import React, { useEffect, useState } from 'react'
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion'
import TL from './timeline.json'
import { C } from './theme'
import { FPS, clamp, easeInOut, easeOut, lerp, prog } from './anim'
import { SceneCreate, SceneDash, SceneHero, SceneOutro, ScenePain, ScenePhone, SceneProof, SceneShare, SceneWA, heroButtonScreen } from './scenes'

type Tr = 'none' | 'whip' | 'zoom' | 'circle' | 'up'
type Def = { id: keyof typeof TL.scene; Comp: React.FC<{ t: number }>; enter: Tr; exit: Tr }
const SCENES: Def[] = [
  { id: 'pain', Comp: ScenePain, enter: 'none', exit: 'whip' },
  { id: 'hero', Comp: SceneHero, enter: 'whip', exit: 'circle' },
  { id: 'dash', Comp: SceneDash, enter: 'circle', exit: 'zoom' },
  { id: 'create', Comp: SceneCreate, enter: 'zoom', exit: 'up' },
  { id: 'share', Comp: SceneShare, enter: 'up', exit: 'zoom' },
  { id: 'wa', Comp: SceneWA, enter: 'zoom', exit: 'whip' },
  { id: 'phone', Comp: ScenePhone, enter: 'whip', exit: 'zoom' },
  { id: 'proof', Comp: SceneProof, enter: 'zoom', exit: 'whip' },
  { id: 'outro', Comp: SceneOutro, enter: 'whip', exit: 'none' },
]
const D = 0.6

function wrapStyle(def: Def, t: number): React.CSSProperties {
  const [a, b] = TL.scene[def.id] as [number, number]
  const pin = def.enter === 'none' ? 1 : prog(t, a, a + D, def.enter === 'whip' ? easeOut : easeInOut)
  const pout = def.exit === 'none' ? 0 : prog(t, b - D, b, easeInOut)
  const tf: string[] = []
  let opacity = 1, filter = '', clip: string | undefined
  if (pin < 1) {
    if (def.enter === 'whip') tf.push(`translateX(${(1 - pin) * 1920}px)`)
    if (def.enter === 'zoom') { tf.push(`scale(${lerp(1.16, 1, pin)})`); opacity *= pin; filter += ` blur(${(1 - pin) * 16}px)` }
    if (def.enter === 'circle') { const c = heroButtonScreen(); clip = `circle(${pin * 2300}px at ${c.x}px ${c.y}px)` }
    if (def.enter === 'up') { clip = `inset(${(1 - pin) * 100}% 0 0 0)`; tf.push(`translateY(${(1 - pin) * 70}px)`) }
  }
  if (pout > 0) {
    if (def.exit === 'whip') { tf.push(`translateX(${-pout * 420}px) scale(${1 - 0.07 * pout})`); opacity *= 1 - pout * 0.5; filter += ` blur(${pout * 10}px)` }
    if (def.exit === 'zoom') { tf.push(`scale(${1 - 0.09 * pout})`); opacity *= 1 - pout; filter += ` blur(${pout * 14}px)` }
    if (def.exit === 'up') { tf.push(`translateY(${-pout * 140}px)`); opacity *= 1 - pout * 0.85 }
  }
  return { transform: tf.join(' ') || undefined, opacity, filter: filter.trim() || undefined, clipPath: clip }
}

/** Accent line that rides each transition edge, like a light leak in AE. */
const EdgeAccent: React.FC<{ t: number }> = ({ t }) => (
  <>
    {SCENES.map((d) => {
      if (d.enter === 'none') return null
      const [a] = TL.scene[d.id] as [number, number]
      if (t < a || t > a + D) return null
      const p = prog(t, a, a + D, d.enter === 'whip' ? easeOut : easeInOut)
      const op = 1 - Math.abs(p - 0.5) * 1.4
      if (d.enter === 'whip') return <div key={d.id} style={{ position: 'absolute', top: 0, bottom: 0, left: (1 - p) * 1920 - 3, width: 6, background: C.lime, opacity: op, boxShadow: `0 0 60px 18px rgba(212,255,63,0.45)` }} />
      if (d.enter === 'up') return <div key={d.id} style={{ position: 'absolute', left: 0, right: 0, top: (1 - p) * 1080 + (1 - p) * 70 - 3, height: 6, background: C.lime, opacity: op, boxShadow: `0 0 60px 18px rgba(212,255,63,0.45)` }} />
      if (d.enter === 'circle') { const c = heroButtonScreen(); const r = p * 2300; return <div key={d.id} style={{ position: 'absolute', left: c.x - r, top: c.y - r, width: r * 2, height: r * 2, borderRadius: r, border: `4px solid ${C.lime}`, opacity: 1 - p, boxShadow: '0 0 50px rgba(212,255,63,0.4)' }} /> }
      return null
    })}
  </>
)

export const Main: React.FC = () => {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const [handle] = useState(() => delayRender('fonts'))
  useEffect(() => {
    Promise.all([
      new FontFace('Geist Sans', `url(${staticFile('fonts/GeistSans.woff2')})`, { weight: '100 900' }).load(),
      new FontFace('Geist Mono', `url(${staticFile('fonts/GeistMono.woff2')})`, { weight: '100 900' }).load(),
    ]).then((fs) => { fs.forEach((f) => document.fonts.add(f)); continueRender(handle) }).catch(() => continueRender(handle))
  }, [handle])

  const fadeIn = 1 - prog(t, 0, 0.35)
  const fadeOut = prog(t, TL.ev.fade, TL.total - 0.05, easeInOut)
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {SCENES.map((d) => {
        const [a, b] = TL.scene[d.id] as [number, number]
        if (t < a - 0.02 || t > b + 0.02) return null
        const { Comp } = d
        return <AbsoluteFill key={d.id} style={wrapStyle(d, t)}><Comp t={t} /></AbsoluteFill>
      })}
      <EdgeAccent t={t} />
      <AbsoluteFill style={{ background: '#000', opacity: Math.max(fadeIn, fadeOut), pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}
