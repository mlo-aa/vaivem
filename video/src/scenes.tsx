import React from 'react'
import { AbsoluteFill } from 'remotion'
import TL from './timeline.json'
import shotsJson from './shots.json'
import { C, MONO, SANS } from './theme'
import { camAt, clamp, easeBack, easeInOut, easeOut, lerp, pathAt, prog, seeded } from './anim'
import { BrowserFrame, Burst, Caption, Cursor, Highlight, Logo, PhoneFrame, Ripple, RevealLine, S, Stage, Touch, Typed, bb, ctr, type Box } from './ui'

type P = { t: number }
const E = TL.ev as Record<string, number>
const TOKEN = (shotsJson as any).token as string
const tri = (t: number, a: number, b: number) => clamp(1 - Math.abs((t - (a + b) / 2) / ((b - a) / 2)))
const press = (t: number, tc: number) => tri(t, tc - 0.08, tc + 0.14)

/* ───────────── 1 · the pain ───────────── */
export const ScenePain: React.FC<P> = ({ t }) => {
  const lines = [
    { t: E.tick1, text: 'Wire fees.', y: 250 },
    { t: E.tick2, text: 'IBAN again.', y: 420 },
    { t: E.tick3, text: '2–5 days.', y: 590 },
  ]
  const blast = prog(t, E.blast, E.blast + 0.4, easeOut)
  const strike = prog(t, E.strike, E.strike + 0.3, easeInOut)
  const ring = prog(t, E.blast, E.blast + 0.9, easeOut)
  return (
    <Stage t={t} glow={0.4}>
      <div style={{ position: 'absolute', left: 200, top: 130, fontFamily: MONO, fontSize: 20, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, opacity: (1 - prog(t, 1.9, 2.1)) * prog(t, 0, 0.4) }}>
        Paying someone abroad
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + blast * 0.3})`, opacity: 1 - blast, filter: `blur(${blast * 24}px)` }}>
        {lines.map((l, i) => (
          <div key={i} style={{ position: 'absolute', left: 200, top: l.y, fontFamily: SANS, fontSize: 138, fontWeight: 500, letterSpacing: '-0.05em', color: C.text }}>
            <RevealLine t={t} t0={l.t} dur={0.45}>{l.text}</RevealLine>
            <div style={{ position: 'absolute', left: -12, top: '54%', height: 9, width: (l.text.length * 82 + 24) * strike, background: C.lime, transformOrigin: 'left' }} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 960 - 700 * ring, top: 540 - 700 * ring, width: 1400 * ring, height: 1400 * ring, borderRadius: 2000, border: `3px solid ${C.lime}`, opacity: (1 - ring) * (t >= E.blast ? 1 : 0) }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontFamily: SANS }}>
        <RevealLine t={t} t0={E.oneLink} dur={0.8} style={{ display: 'inline-block' }}>
          <div style={{ fontSize: 300, fontWeight: 500, letterSpacing: '-0.06em', color: C.lime, lineHeight: 1 }}>One link.</div>
        </RevealLine>
        <RevealLine t={t} t0={3.0} dur={0.7} style={{ marginTop: 26 }}>
          <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>Walletless payouts on Stellar</div>
        </RevealLine>
      </div>
    </Stage>
  )
}

/* ───────────── 2 · landing → "Try the demo" ───────────── */
const HERO_FOCUS = () => { const b = ctr(bb('landing', 'demoBtn')); return { fx: b.x + 120, fy: b.y - 40, z: 2.1 } }
export const heroButtonScreen = () => {
  const b = ctr(bb('landing', 'demoBtn')); const f = HERO_FOCUS(); const s0 = 1920 / 1440; const scale = s0 * f.z
  const tx = clamp(960 - f.fx * scale, 1920 - 1440 * scale, 0), ty = clamp(540 - f.fy * scale, 1080 - 810 * scale, 0)
  return { x: b.x * scale + tx, y: b.y * scale + ty }
}
export const SceneHero: React.FC<P> = ({ t }) => {
  const f = HERO_FOCUS(); const btn = ctr(bb('landing', 'demoBtn'))
  const cam = camAt(t, [
    { t: 3.8, fx: 720, fy: 405, z: 1.0 }, { t: 8.0, fx: 740, fy: 405, z: 1.035 }, { t: 10.15, ...f }, { t: 12, ...f },
  ])
  const capP = prog(t, 5.0, 5.5, easeOut) * (1 - prog(t, 7.4, 7.8))
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <BrowserFrame layers={[{ shot: 'landing' }]} left={0} top={0} width={1920} chrome={false} cam={cam}
        overlay={(k) => {
          const pts = [{ t: 8.0, x: 1250, y: 560 }, { t: 9.4, x: 620, y: 650 }, { t: 10.22, x: btn.x + 8, y: btn.y + 5 }]
          const c = pathAt(t, pts, k)
          return (
            <>
              <Highlight box={bb('landing', 'demoBtn')} t={t} t0={10.0} t1={11.7} k={k} dim={0.28} />
              <Ripple x={btn.x} y={btn.y} k={k} t={t} t0={E.clickDemo} />
              {t >= 8.0 && <Cursor x={c.x} y={c.y} k={k} press={press(t, E.clickDemo)} o={prog(t, 8.0, 8.3)} />}
            </>
          )
        }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, display: 'flex', justifyContent: 'center', opacity: capP, transform: `translateY(${(1 - capP) * 24}px)` }}>
        <div style={{ padding: '16px 28px', background: 'rgba(10,10,11,0.82)', border: `1px solid ${C.line}`, backdropFilter: 'blur(10px)', fontFamily: MONO, fontSize: 28, color: C.lime, letterSpacing: '0.02em' }}>
          <Typed t={t} t0={5.0} t1={6.5} text="No wallet. No app. Just a link." />
          <span style={{ opacity: Math.floor(t * 3) % 2 }}>_</span>
        </div>
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: tri(t, E.clickDemo - 0.02, E.clickDemo + 0.16) * 0.13 }} />
    </AbsoluteFill>
  )
}

/* ───────────── 3 · dashboard ───────────── */
export const SceneDash: React.FC<P> = ({ t }) => {
  const sh = 'dashboard-dark'
  const th = bb(sh, 'theme'), nc = bb(sh, 'newClaim'), badge = bb(sh, 'badge'), bal = bb(sh, 'balance')
  const cam = camAt(t, [
    { t: 10.9, fx: 720, fy: 500, z: 1.0 }, { t: 12.3, fx: 560, fy: 190, z: 1.5 }, { t: 14.2, fx: 720, fy: 480, z: 1.0 },
    { t: 16.5, fx: 1130, fy: 210, z: 1.55 }, { t: 18.2, fx: 1130, fy: 210, z: 1.55 },
  ])
  const thc = ctr(th)
  const toLight = prog(t, E.themeLight, E.themeLight + 0.9, easeInOut) * 1900
  const toDark = prog(t, E.themeDark, E.themeDark + 0.9, easeInOut) * 1900
  const layers = [
    { shot: sh },
    { shot: 'dashboard-light', clip: toLight > 0 ? `circle(${toLight}px at ${thc.x}px ${thc.y}px)` : 'circle(0px at 0 0)' },
    { shot: sh, clip: toDark > 0 ? `circle(${toDark}px at ${thc.x}px ${thc.y}px)` : 'circle(0px at 0 0)' },
  ]
  return (
    <Stage t={t}>
      <Caption t={t} t0={11.3} exitAt={17.3} x={90} y={300} w={500} eyebrow="Demo account" lines={['Instant', 'demo account.']} sub="No email. Test funds already loaded." size={72} />
      <BrowserFrame layers={layers} left={620} top={88} width={1240} cam={cam}
        overlay={(k) => {
          const pts = [{ t: 15.9, x: 1500, y: 640 }, { t: 17.2, x: ctr(nc).x + 6, y: ctr(nc).y + 4 }]
          const c = pathAt(t, pts, k)
          return (
            <>
              <Highlight box={badge} t={t} t0={E.hlBadge} t1={13.6} k={k} label="Demo · Testnet" pad={6} />
              <Highlight box={{ x: 288, y: 118, w: 560, h: 108 }} t={t} t0={E.hlBalance} t1={14.5} k={k} label="10 USDC test funds" pad={6} />
              <Highlight box={th} t={t} t0={14.45} t1={16.1} k={k} label="Light & dark" pad={6} below />
              <Ripple x={ctr(nc).x} y={ctr(nc).y} k={k} t={t} t0={E.clickNew} />
              {t >= 15.9 && <Cursor x={c.x} y={c.y} k={k} press={press(t, E.clickNew)} o={prog(t, 15.9, 16.2)} />}
            </>
          )
        }} />
    </Stage>
  )
}

/* ───────────── 4 · create a claim ───────────── */
const Steps: React.FC<{ t: number }> = ({ t }) => {
  const active = t < E.clickCont1 + 0.1 ? 0 : t < E.clickCont2 + 0.1 ? 1 : 2
  const done = t >= E.swapDone
  const items = ['Amount', 'Recipient', 'Review']
  const o = prog(t, 17.9, 18.4, easeOut)
  return (
    <div style={{ position: 'absolute', left: 90, top: 380, opacity: o, transform: `translateX(${(1 - o) * -30}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.lime, marginBottom: 34 }}>{done ? 'Link is live' : 'Create a claim'}</div>
      {items.map((s, i) => {
        const on = done || i <= active
        const cur = !done && i === active
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 30, position: 'relative' }}>
            {i < 2 && <div style={{ position: 'absolute', left: 21, top: 48, width: 2, height: 38, background: on && (done || i < active) ? C.lime : C.line }} />}
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontFamily: MONO, fontSize: 20, fontWeight: 600, background: on ? C.lime : C.panel2, color: on ? '#0a0a0b' : C.muted, border: `1px solid ${on ? C.lime : C.line}`, boxShadow: cur ? '0 0 0 6px rgba(212,255,63,0.16)' : 'none' }}>{done || i < active ? '✓' : i + 1}</div>
            <div style={{ fontFamily: SANS, fontSize: 40, fontWeight: 500, letterSpacing: '-0.03em', color: cur || done ? C.text : C.muted }}>{s}</div>
          </div>
        )
      })}
    </div>
  )
}
export const SceneCreate: React.FC<P> = ({ t }) => {
  const w1 = 'wizard-1-filled', w2 = 'wizard-2-filled', w3 = 'wizard-3-review'
  const layers = [
    { shot: 'wizard-1-empty' },
    { shot: w1, o: prog(t, E.typeAmountB, E.typeAmountB + 0.15, easeInOut) },
    { shot: 'wizard-2-empty', o: prog(t, E.clickCont1 + 0.1, E.clickCont1 + 0.3, easeInOut) },
    { shot: w2, o: prog(t, E.swapFilled2, E.swapFilled2 + 0.15, easeInOut) },
    { shot: w3, o: prog(t, E.clickCont2 + 0.1, E.clickCont2 + 0.3, easeInOut) },
    { shot: 'wizard-4-funding', o: prog(t, E.swapFunding, E.swapFunding + 0.2, easeInOut) },
    { shot: 'wizard-5-done', o: prog(t, E.swapDone, E.swapDone + 0.2, easeInOut) },
  ]
  const cam = camAt(t, [
    { t: 17.5, fx: 720, fy: 500, z: 1.0 }, { t: 18.2, fx: 800, fy: 340, z: 1.35 }, { t: 21.0, fx: 800, fy: 340, z: 1.35 },
    { t: 21.8, fx: 720, fy: 480, z: 1.0 }, { t: 22.3, fx: 700, fy: 400, z: 1.4 }, { t: 25.8, fx: 700, fy: 470, z: 1.35 },
    { t: 26.5, fx: 720, fy: 560, z: 1.0 }, { t: 27.1, fx: 900, fy: 560, z: 1.6 }, { t: 28.7, fx: 900, fy: 560, z: 1.6 },
    { t: 29.3, fx: 720, fy: 420, z: 1.15 }, { t: 30.8, fx: 720, fy: 480, z: 1.0 },
  ])
  const quote = { x: 1040, y: 142, w: 322, h: 372 }
  const frameLeft = 520, width = 1320
  return (
    <Stage t={t}>
      <Steps t={t} />
      <BrowserFrame layers={layers} left={frameLeft} top={62} width={width} cam={cam}
        overlay={(k) => {
          const pts = [
            { t: 17.5, x: 1296, y: 40 }, { t: 18.4, x: 620, y: 378 },
            { t: 20.2, x: 700, y: 400 }, { t: 21.3, x: 953, y: 844 },
            { t: 22.2, x: 676, y: 269 }, { t: 23.4, x: 560, y: 537 }, { t: 23.95, x: 640, y: 650 }, { t: 26.5, x: 953, y: 873 },
            { t: 28.4, x: 917, y: 604 }, { t: 30.0, x: 700, y: 690 }, { t: 30.5, x: 718, y: 701 },
          ]
          const c = pathAt(t, pts, k)
          const clicks = [E.clickAmount, E.clickCont1, E.clickRecipient, E.clickProt, E.clickMsg, E.clickCont2, E.clickFund, E.clickView]
          const pr = Math.max(...clicks.map((tc) => press(t, tc)))
          const cl = [[620, 378, E.clickAmount], [953, 844, E.clickCont1], [676, 269, E.clickRecipient], [560, 537, E.clickProt], [640, 650, E.clickMsg], [953, 873, E.clickCont2], [917, 604, E.clickFund], [718, 701, E.clickView]]
          return (
            <>
              <Highlight box={quote} t={t} t0={E.hlQuote} t1={21.3} k={k} label="You lock 4.87 USDC" pad={4} radius={6} dim={0.45} />
              <Highlight box={bb('wizard-2-empty', 'recipient')} t={t} t0={22.3} t1={23.3} k={k} dim={0.3} pad={5} />
              <Highlight box={{ x: 336, y: 480, w: 690, h: 110 }} t={t} t0={23.4} t1={24.2} k={k} label="Public link, code or email" dim={0.3} pad={4} />
              <Highlight box={{ x: 361, y: 600, w: 630, h: 90 }} t={t} t0={24.2} t1={25.7} k={k} dim={0.3} pad={4} />
              <Highlight box={{ x: 336, y: 530, w: 680, h: 96 }} t={t} t0={E.hlFund - 0.3} t1={28.4} k={k} dim={0.0} pad={0} />
              <Highlight box={bb(w3, 'fundBtn')} t={t} t0={E.hlFund} t1={28.55} k={k} label="Funds locked in escrow on Stellar" dim={0.5} pad={6} below />
              <Highlight box={bb('wizard-4-funding', 'title')} t={t} t0={E.swapFunding + 0.2} t1={29.8} k={k} dim={0} pad={30} radius={8} />
              {cl.map(([x, y, tc], i) => <Ripple key={i} x={x as number} y={y as number} k={k} t={t} t0={tc as number} />)}
              <Cursor x={c.x} y={c.y} k={k} press={pr} />
            </>
          )
        }} />
      <Burst cx={frameLeft + width / 2} cy={420} t={t} t0={E.swapDone} />
    </Stage>
  )
}

/* ───────────── 5 · share ───────────── */
export const SceneShare: React.FC<P> = ({ t }) => {
  const sh = 'detail-created'
  const link = bb(sh, 'link'), wa = bb(sh, 'whatsapp'), qr = bb(sh, 'qr')
  const cam = camAt(t, [
    { t: 30.8, fx: 720, fy: 500, z: 1.0 }, { t: 31.7, fx: 1190, fy: 480, z: 1.4 }, { t: 35.2, fx: 1190, fy: 500, z: 1.45 },
  ])
  return (
    <Stage t={t}>
      <Caption t={t} t0={31.2} exitAt={34.4} x={90} y={330} w={470} eyebrow="Share" lines={['Share it', 'anywhere.']} sub="WhatsApp, email or QR. The recipient needs nothing installed." size={70} />
      <BrowserFrame layers={[{ shot: 'detail-created' }]} left={590} top={72} width={1250} cam={cam}
        overlay={(k) => {
          const pts = [{ t: 31.6, x: 800, y: 700 }, { t: 33.0, x: ctr(link).x, y: ctr(link).y }, { t: 34.2, x: ctr(wa).x, y: ctr(wa).y }]
          const c = pathAt(t, pts, k)
          return (
            <>
              <div style={{ position: 'absolute', left: link.x + 2 * k, top: link.y + 2 * k, width: link.w - 4 * k, height: link.h - 4 * k, background: '#0f0f11', borderRadius: 6 * k, display: 'flex', alignItems: 'center', paddingLeft: 14 * k, fontFamily: MONO, fontSize: link.h * 0.36, color: '#e8e8ea', overflow: 'hidden', whiteSpace: 'nowrap' }}>tryvaivem.vercel.app/claim/4VBWGY4T49NF</div>
              <Highlight box={qr} t={t} t0={31.9} t1={32.7} k={k} dim={0.3} pad={6} radius={8} />
              <Highlight box={link} t={t} t0={E.hlLink} t1={33.5} k={k} label="Secure claim link" pad={6} />
              <Highlight box={wa} t={t} t0={E.hlWa} t1={34.6} k={k} label="Share on WhatsApp" pad={6} dim={0.5} below />
              <Ripple x={ctr(wa).x} y={ctr(wa).y} k={k} t={t} t0={E.clickWa} />
              {t >= 31.6 && <Cursor x={c.x} y={c.y} k={k} press={press(t, E.clickWa)} o={prog(t, 31.6, 31.9)} />}
            </>
          )
        }} />
    </Stage>
  )
}

/* ───────────── 5b · generated screen: the chat ───────────── */
const Tick: React.FC<{ c: string }> = ({ c }) => (
  <svg width="18" height="11" viewBox="0 0 18 11"><path d="M1 5.5 L4.5 9 L10.5 1.5 M7 9 L13 1.5" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ChatMock: React.FC<{ t: number }> = ({ t }) => {
  const msg = 'Hi Ana! Here is your payment for the design work.'
  const typedP = clamp((t - E.waTypeA) / (E.waTypeB - E.waTypeA))
  const typed = msg.slice(0, Math.round(msg.length * typedP))
  const sent = t >= E.waSend
  const b1 = prog(t, E.waSend, E.waSend + 0.45, easeBack)
  const b2 = prog(t, E.waSend + 0.4, E.waSend + 0.9, easeBack)
  const delivered = t >= E.waDelivered, read = t >= E.waRead
  const tc = read ? '#53bdeb' : '#8696a0'
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0b141a', fontFamily: SANS, color: '#e9edef' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1.2px, transparent 1.2px)', backgroundSize: '22px 22px' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 118, background: '#1f2c34', paddingTop: 46, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 14 }}>
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M15 5 L8 12 L15 19" fill="none" stroke="#aebac1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div style={{ width: 42, height: 42, borderRadius: 21, background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#d1d7db' }}>AS</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Ana Souza</div>
          <div style={{ fontSize: 13, color: '#8696a0' }}>online</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 136, textAlign: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', background: '#1f2c34', color: '#8696a0', padding: '5px 10px', borderRadius: 6 }}>TODAY</span>
      </div>
      {sent && (
        <div style={{ position: 'absolute', right: 14, top: 190, maxWidth: 270, transform: `scale(${0.6 + 0.4 * b1}) translateY(${(1 - b1) * 20}px)`, transformOrigin: 'right bottom', opacity: b1 }}>
          <div style={{ background: '#005c4b', borderRadius: '12px 12px 4px 12px', padding: '9px 12px 6px', fontSize: 17, lineHeight: 1.3 }}>
            {msg}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: '#8fb9ae' }}>9:41</span>
              {delivered && <Tick c={tc} />}
            </div>
          </div>
        </div>
      )}
      {t >= E.waSend + 0.4 && (
        <div style={{ position: 'absolute', right: 14, top: 300, width: 292, transform: `scale(${0.6 + 0.4 * b2}) translateY(${(1 - b2) * 20}px)`, transformOrigin: 'right top', opacity: b2 }}>
          <div style={{ background: '#005c4b', borderRadius: '12px 12px 4px 12px', padding: 4 }}>
            <div style={{ borderRadius: 9, overflow: 'hidden', background: '#0b2b26' }}>
              <div style={{ height: 128, background: `linear-gradient(135deg, #0e0f11, #1a1d12)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 8px)' }} />
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', color: C.lime, position: 'relative' }}>YOU RECEIVED</div>
                <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', color: '#fff', position: 'relative' }}>R$ 25,00</div>
              </div>
              <div style={{ padding: '9px 11px 10px' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>vaivem · Released only to you</div>
                <div style={{ fontSize: 13, color: '#8fb9ae', marginTop: 2 }}>No wallet. No app. Just tap.</div>
              </div>
            </div>
            <div style={{ padding: '7px 8px 3px', fontSize: 15, color: '#53bdeb', textDecoration: 'underline', wordBreak: 'break-all' }}>tryvaivem.vercel.app/claim/{TOKEN}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 5, padding: '0 8px 4px' }}>
              <span style={{ fontSize: 11, color: '#8fb9ae' }}>9:41</span>
              {delivered && <Tick c={tc} />}
            </div>
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 30, height: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 46, borderRadius: 23, background: '#1f2c34', display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 17, color: sent ? '#8696a0' : '#e9edef' }}>
          {sent ? 'Message' : typed || <span style={{ color: '#8696a0' }}>Message</span>}
          {!sent && typedP > 0 && typedP < 1 && <span style={{ width: 2, height: 22, background: '#00a884', marginLeft: 2, opacity: Math.floor(t * 4) % 2 }} />}
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 23, background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - press(t, E.waSend) * 0.12})` }}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 20 L21 12 L3 4 L3 10 L15 12 L3 14 Z" fill="#0b141a" /></svg>
        </div>
      </div>
    </div>
  )
}
export const SceneWA: React.FC<P> = ({ t }) => {
  const float = Math.sin(t * 1.1) * 6
  return (
    <Stage t={t}>
      <Caption t={t} t0={35.0} exitAt={38.2} x={110} y={340} w={640} eyebrow="Delivery" lines={['Straight to', 'her phone.']} sub="One message. One link." size={76} />
      <Caption t={t} t0={38.45} x={110} y={340} w={640} eyebrow="Delivered" lines={['She taps.', 'That is it.']} size={76} />
      <PhoneFrame left={1090} top={70 + float} height={940}>
        <ChatMock t={t} />
      </PhoneFrame>
    </Stage>
  )
}

/* ───────────── 6 · the recipient ───────────── */
export const ScenePhone: React.FC<P> = ({ t }) => {
  const sh = 'phone-1-choose'
  const layers = [
    { shot: 'phone-1-choose' },
    { shot: 'phone-2-processing', o: prog(t, E.clickPhoneCont + 0.1, E.clickPhoneCont + 0.3, easeInOut) },
    { shot: 'phone-3-done', o: prog(t, E.swapDonePhone, E.swapDonePhone + 0.25, easeInOut) },
  ]
  const wallet = bb(sh, 'wallet'), cont = bb(sh, 'continueBtn'), amt = bb(sh, 'amount'), tx = bb('phone-3-done', 'tx')
  const float = Math.sin(t * 1.0) * 5
  const push = 1 + prog(t, 39.8, 51.6, easeInOut) * 0.035
  return (
    <Stage t={t}>
      <Caption t={t} t0={40.2} exitAt={43.0} x={110} y={320} w={720} eyebrow="Recipient" lines={['She opens', 'the link.']} sub="No account. No wallet. No app." size={82} />
      <Caption t={t} t0={43.3} exitAt={46.2} x={110} y={320} w={720} eyebrow="Claim" lines={['One tap.']} sub="Funds leave escrow and settle on Stellar." size={92} />
      <Caption t={t} t0={46.6} x={110} y={320} w={720} eyebrow="Received" lines={['Money', 'received.']} sub="Verifiable on-chain in seconds." size={92} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '1300px 540px' }}>
        <PhoneFrame left={1060} top={50 + float} height={960} layers={layers}
          overlay={(k) => {
            const pts = [{ t: 43.0, x: 200, y: 800 }, { t: 43.5, x: ctr(cont).x, y: ctr(cont).y }]
            const c = pathAt(t, pts, k * 0.5)
            return (
              <>
                <Highlight box={amt} t={t} t0={40.7} t1={41.7} k={k} dim={0.3} pad={6} radius={8} label="You received R$ 25,00" below />
                <Highlight box={wallet} t={t} t0={E.hlWallet} t1={43.2} k={k} dim={0.35} pad={5} radius={6} label="Any Stellar wallet" />
                <Highlight box={tx} t={t} t0={47.4} t1={50.4} k={k} dim={0.35} pad={6} radius={6} label="On-chain proof" below />
                <Ripple x={ctr(cont).x} y={ctr(cont).y} k={k} t={t} t0={E.clickPhoneCont} />
                {t >= 43.0 && t < 44.3 && <Touch x={c.x} y={c.y} k={k} press={press(t, E.clickPhoneCont)} o={prog(t, 43.0, 43.2) * (1 - prog(t, 43.9, 44.3))} />}
              </>
            )
          }} />
      </div>
      <Burst cx={1060 + 230} cy={330} t={t} t0={E.swapDonePhone} n={46} r={520} />
    </Stage>
  )
}

/* ───────────── 7 · proof ───────────── */
export const SceneProof: React.FC<P> = ({ t }) => {
  const layers = [{ shot: 'detail-created' }, { shot: 'detail-completed', o: prog(t, 51.5, 51.9, easeInOut) }]
  const badge: Box = { x: 505, y: 160, w: 86, h: 26 }
  const txb: Box = { x: 361, y: 506, w: 150, h: 24 }
  const claimed: Box = { x: 361, y: 936, w: 330, h: 56 }
  const cam = camAt(t, [
    { t: 51.0, fx: 720, fy: 500, z: 1.0 }, { t: 52.4, fx: 560, fy: 190, z: 1.5 }, { t: 54.0, fx: 560, fy: 190, z: 1.5 },
    { t: 54.8, fx: 560, fy: 560, z: 1.5 }, { t: 57.2, fx: 560, fy: 880, z: 1.45 }, { t: 58.6, fx: 560, fy: 880, z: 1.45 },
  ])
  return (
    <Stage t={t}>
      <Caption t={t} t0={51.5} exitAt={57.4} x={90} y={330} w={480} eyebrow="Proof" lines={['Settled in', 'seconds.']} sub="Every step on the timeline. Every payout verifiable on Stellar." size={72} />
      <BrowserFrame layers={layers} left={600} top={72} width={1250} cam={cam}
        overlay={(k) => (
          <>
            <Highlight box={badge} t={t} t0={52.2} t1={53.9} k={k} label="Completed" pad={5} radius={6} />
            <Highlight box={txb} t={t} t0={54.5} t1={56.0} k={k} label="On-chain proof" pad={6} below />
            <Highlight box={claimed} t={t} t0={56.0} t1={58.2} k={k} label="Funds claimed" pad={6} />
          </>
        )} />
    </Stage>
  )
}

/* ───────────── 8 · outro ───────────── */
const TerrainDots: React.FC<{ t: number; p: number }> = ({ t, p }) => {
  const cols = 120, size = 6
  const rects: React.ReactNode[] = []
  for (let i = 0; i < cols; i++) {
    const h = (70 + 110 * (0.5 + 0.5 * Math.sin(i * 0.085 + t * 0.55)) + 80 * (0.5 + 0.5 * Math.sin(i * 0.23 - t * 0.8))) * p
    const rows = Math.floor(h / 13)
    for (let r = 0; r < rows; r++) {
      const dens = 1 - r / rows
      if (seeded('tt', i * 40 + r) > 0.25 + dens * 0.75) continue
      rects.push(<rect key={`${i}-${r}`} x={i * 16 + 5} y={330 - r * 13} width={size} height={size} fill={r === rows - 1 ? C.lime : r % 5 === 0 ? C.limeDim : C.lime} opacity={r === rows - 1 ? 1 : 0.25 + dens * 0.6} />)
    }
  }
  return <svg width={1920} height={340} style={{ position: 'absolute', left: 0, bottom: 0 }}>{rects}</svg>
}
export const SceneOutro: React.FC<P> = ({ t }) => {
  const rise = prog(t, 58.0, 60.0, easeOut)
  const logoP = prog(t, E.logoHit, E.logoHit + 0.8, easeOut)
  const chips = [['No wallet needed', E.chip1], ['Escrow on Stellar, refundable', E.chip2], ['PIX and SPEI rails (sandbox)', E.chip3]] as [string, number][]
  const cta = prog(t, E.cta, E.cta + 0.6, easeBack)
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2)
  return (
    <Stage t={t} glow={1.3}>
      <TerrainDots t={t} p={rise} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center', opacity: logoP, transform: `scale(${0.8 + 0.2 * logoP})` }}>
        <Logo height={78} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center', fontFamily: SANS }}>
        <RevealLine t={t} t0={58.9} dur={0.8} style={{ display: 'inline-block' }}>
          <div style={{ fontSize: 150, fontWeight: 500, letterSpacing: '-0.055em', color: C.text, lineHeight: 1 }}>Walletless payouts.</div>
        </RevealLine>
        <RevealLine t={t} t0={59.2} dur={0.7} style={{ marginTop: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>Built on Stellar · Live testnet demo</div>
        </RevealLine>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 600, display: 'flex', justifyContent: 'center', gap: 22 }}>
        {chips.map(([txt, t0], i) => {
          const p = prog(t, t0, t0 + 0.5, easeBack)
          return <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.92 + 0.08 * p})`, padding: '15px 26px', border: `1px solid ${C.line}`, background: 'rgba(14,15,17,0.88)', fontFamily: MONO, fontSize: 23, color: C.text, letterSpacing: '0.01em', borderRadius: 4 }}><span style={{ color: C.lime, marginRight: 12 }}>+</span>{txt}</div>
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 740, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, opacity: cta, transform: `translateY(${(1 - cta) * 36}px)` }}>
        <div style={{ padding: '22px 44px', background: C.lime, color: '#0a0a0b', fontFamily: SANS, fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', borderRadius: 4, boxShadow: `0 0 ${50 + pulse * 40}px rgba(212,255,63,${0.25 + pulse * 0.2})` }}>Try the demo</div>
        <div style={{ fontFamily: MONO, fontSize: 30, color: C.text }}>tryvaivem.vercel.app</div>
      </div>
    </Stage>
  )
}
