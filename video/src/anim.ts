import { Easing, random } from 'remotion'

export const FPS = 30
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1)   // "easy ease"
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1)      // fast attack, long settle
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0)
export const easeBack = Easing.bezier(0.34, 1.45, 0.64, 1) // slight overshoot

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p
/** progress of t inside [a,b], eased, clamped to 0..1 */
export const prog = (t: number, a: number, b: number, e: (x: number) => number = easeInOut) =>
  e(clamp((t - a) / (b - a)))

export type CamKey = { t: number; fx: number; fy: number; z: number }
/** Camera keyframes (focus point in image px + zoom), eased between keys. */
export function camAt(t: number, keys: CamKey[]): { fx: number; fy: number; z: number } {
  if (t <= keys[0].t) return keys[0]
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1]
    if (t <= b.t) {
      const p = prog(t, a.t, b.t)
      return { fx: lerp(a.fx, b.fx, p), fy: lerp(a.fy, b.fy, p), z: lerp(a.z, b.z, p) }
    }
  }
  return keys[keys.length - 1]
}

export type Pt = { t: number; x: number; y: number }
/** Cursor along waypoints with eased, slightly arced motion. k scales the arc to the current zoom. */
export function pathAt(t: number, pts: Pt[], k = 1) {
  if (t <= pts[0].t) return { x: pts[0].x, y: pts[0].y }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (t <= b.t) {
      const p = prog(t, a.t, b.t)
      const arc = Math.sin(Math.PI * p) * 26 * k
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) - arc }
    }
  }
  const l = pts[pts.length - 1]
  return { x: l.x, y: l.y }
}

export const seeded = (seed: string, i = 0) => random(`${seed}-${i}`)
