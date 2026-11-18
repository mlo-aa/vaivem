'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { LandingNav } from '@/components/marketing/landing-nav'
import { PixelField } from '@/components/marketing/pixel-field'
import { DitherDivider } from '@/components/marketing/dither-divider'
import { AsciiReceipt, AsciiTicker, useTyped } from '@/components/marketing/ascii'
import {
  coinScene,
  dustScene,
  linkScene,
  pixScene,
  wordScene,
} from '@/components/marketing/pixel-scenes'

const INK = '#050505'
const LIME = '#d4ff3f'
const COBALT = '#1537ff'
const BONE = '#e8e9ee'

const HERO_SCENES = [wordScene('VAIVÉM', { zone: 'hero-word' }), dustScene]
const FLOW_SCENES = [coinScene, linkScene, pixScene]
const CTA_SCENES = [wordScene('VAI E VEM', { anchor: 'center', fill: 0.92 })]

const KIT_CODE = `const res = await fetch("/api/v1/claims", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.VAIVEM_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: "10",
    currency: "BRL",
    recipient: { name: "Ana", email: "ana@example.com" },
    protection: "email",
  }),
})
const claim = await res.json()
console.log(claim.claimUrl)`

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Smaller cells on phones so the shapes keep their detail. */
function useCell(desktop: number, mobile: number) {
  const [cell, setCell] = useState(desktop)
  useEffect(() => {
    const set = () => setCell(window.innerWidth < 640 ? mobile : desktop)
    set()
    window.addEventListener('resize', set)
    return () => window.removeEventListener('resize', set)
  }, [desktop, mobile])
  return cell
}

function PixelButton({
  href,
  children,
  variant = 'solid',
  tone = 'lime',
}: {
  href: string
  children: ReactNode
  variant?: 'solid' | 'line'
  tone?: 'lime' | 'ink' | 'bone'
}) {
  const solid = {
    lime: 'bg-[var(--lp-lime)] text-black shadow-[5px_5px_0_var(--lp-bone)]',
    ink: 'bg-[var(--lp-ink)] text-[var(--lp-lime)] shadow-[5px_5px_0_var(--lp-lime)]',
    bone: 'bg-[var(--lp-bone)] text-black shadow-[5px_5px_0_var(--lp-lime)]',
  }[tone]
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 border-2 border-current px-5 py-3 text-sm font-bold transition-[transform,box-shadow] duration-100',
        'hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:translate-y-[4px]',
        variant === 'solid' ? solid : 'shadow-[5px_5px_0_currentColor]',
      )}
    >
      {children}
      <span aria-hidden>&gt;</span>
    </Link>
  )
}

export function LandingPage() {
  return (
    <div className="lp min-h-screen overflow-x-clip">
      <LandingNav />
      <main>
        <Hero />
        <DitherDivider from={INK} to={COBALT} rows={18} />
        <Problem />
        <DitherDivider from={COBALT} to={LIME} rows={18} />
        <Flow />
        <DitherDivider from={LIME} to={INK} rows={18} />
        <Kit />
        <DitherDivider from={INK} to={BONE} rows={18} />
        <Proof />
        <DitherDivider from={BONE} to={COBALT} rows={18} />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}

/* ─────────────────────────────── Act I · hero ─────────────────────────────── */

function Hero() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLElement>(null)
  const cell = useCell(7, 5)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const progress = useTransform(scrollYProgress, [0, 0.75], [0, 1])

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-9 top-0">
        <PixelField
          scenes={HERO_SCENES}
          progress={progress}
          cell={cell}
          color={LIME}
          accent={BONE}
          idle="wave"
          radius={11}
          label="VAIVÉM"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1400px] flex-none px-4 pt-24 sm:px-8 sm:pt-28">
        <p className="text-xs text-[var(--lp-lime)] sm:text-sm">
          <span aria-hidden>&gt; </span>vaivem send 500 --to ana<span className="lp-caret">_</span>
        </p>
        <h1 className="lp-pixel mt-4 max-w-[17ch] text-balance text-[clamp(2.4rem,6.4vw,5.4rem)] leading-[0.96]">
          {t('heroTitle')}
        </h1>
        <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-[var(--lp-bone)]/75 sm:text-[15px]">
          {t('heroBody')}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-5">
          <PixelButton href="/dashboard">{t('ctaCreate')}</PixelButton>
          <PixelButton href="/developers" variant="line">
            {t('ctaDevelopers')}
          </PixelButton>
          <p className="text-xs text-[var(--lp-bone)]/55 lg:ml-auto lg:text-right">
            <span className="block">{t('heroAside')}</span>
            <span className="mt-1 hidden lg:block">{t('heroHint')}</span>
          </p>
        </div>
      </div>

      <div id="hero-word" className="relative z-0 mb-0 mt-6 min-h-[clamp(150px,26svh,300px)] flex-1" aria-hidden />

      <AsciiTicker
        className="relative z-10 h-9 bg-[var(--lp-lime)] py-2 text-xs text-black"
        items={[
          '$ 500.00 USDC ──> ://vaivem/c/7KQ2 ──> R$ 2,565.97 PIX',
          '[ link ]──[ claim ]──[ cash out ]',
          '$ 100.00 USDC ──> ://vaivem/c/M4X9 ──> $ 1,838.16 SPEI',
          '< vai e vem >',
        ]}
      />
    </section>
  )
}

/* ───────────────────────────── Act II · the problem ───────────────────────────── */

const BAR = 24

function Lane({
  label,
  time,
  filled,
  rows,
  tone,
}: {
  label: string
  time: string
  filled: number
  rows: { text: string; shown: boolean; ok: boolean }[]
  tone: 'old' | 'new'
}) {
  return (
    <div className={cn('border-2 border-white p-4 sm:p-5', tone === 'new' && 'bg-[var(--lp-lime)] text-black border-black')}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-bold">{label}</span>
        <span className="lp-num text-xl tabular-nums">{time}</span>
      </div>
      <p className="mt-3 whitespace-pre text-[15px] leading-none tracking-tighter sm:text-lg" aria-hidden>
        [{'█'.repeat(filled)}
        {'░'.repeat(BAR - filled)}]
      </p>
      <ul className="mt-4 flex min-h-[3.6rem] flex-col gap-1 text-[13px]">
        {rows.map((r) => (
          <li key={r.text} className={cn('transition-opacity duration-200', r.shown ? 'opacity-100' : 'opacity-0')}>
            <span aria-hidden>{r.ok ? '[+] ' : '[x] '}</span>
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Problem() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLElement>(null)
  const [step, setStep] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) =>
    setStep(Math.round(clamp01((v - 0.1) / 0.78) * BAR)),
  )

  const days = Math.floor((step / BAR) * 5)
  return (
    <section id="problem" ref={ref} className="relative h-[260vh] bg-[var(--lp-cobalt)] text-white">
      <div className="sticky top-0 flex h-[100svh] items-center">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-8 px-4 sm:px-8 lg:grid-cols-[1fr_minmax(0,560px)] lg:gap-16">
          <div>
            <p className="text-xs opacity-80 sm:text-sm">{t('problemEyebrow')}</p>
            <h2 className="lp-pixel mt-4 max-w-[20ch] text-balance text-[clamp(1.9rem,4.6vw,3.9rem)] leading-[1.02]">
              {t('problemTitle')}
            </h2>
            <p className="mt-5 max-w-[48ch] text-sm leading-relaxed opacity-85 sm:text-[15px]">{t('problemBody')}</p>
            <p className="mt-8 hidden text-xs opacity-70 lg:block">
              {t('problemHint')}
              <span className="lp-caret">_</span>
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Lane
              tone="old"
              label={t('problemBeforeLabel')}
              time={step >= BAR ? t('problemBeforeDays') : `D+${days}`}
              filled={step}
              rows={[
                { text: t('problemBeforeFees'), shown: step >= 8, ok: false },
                { text: t('problemBeforeForms'), shown: step >= 16, ok: false },
              ]}
            />
            <Lane
              tone="new"
              label={t('problemAfterLabel')}
              time={step >= 3 ? t('problemAfterDays') : '…'}
              filled={Math.min(BAR, step * 8)}
              rows={[
                { text: t('problemAfterFees'), shown: step >= 3, ok: true },
                { text: t('problemAfterForms'), shown: step >= 4, ok: true },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────────── Act III · how it works ───────────────────────────── */

const FLOW_CMDS = [
  '$ vaivem send 500 --to ana',
  '> ana opened ://vaivem/c/7KQ2  [verified]',
  '> pix R$500,00 --> ana@bank  [settled]',
]

function Flow() {
  const t = useTranslations('landing')
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const cell = useCell(8, 6)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const stage = useTransform(scrollYProgress, [0.06, 0.94], [0, 2])
  useMotionValueEvent(stage, 'change', (v) => setActive(Math.round(v)))

  const steps = [
    { title: t('flowStep1Title'), body: t('flowStep1Body') },
    { title: t('flowStep2Title'), body: t('flowStep2Body') },
    { title: t('flowStep3Title'), body: t('flowStep3Body') },
  ]

  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    const room = el.offsetHeight - window.innerHeight
    const top = el.getBoundingClientRect().top + window.scrollY + (0.06 + 0.88 * (i / 2)) * room
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section id="how-it-works" ref={ref} className="relative h-[340vh] bg-[var(--lp-lime)] text-black">
      <div className="sticky top-0 flex h-[100svh] items-center">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-6 px-4 pt-16 sm:px-8 lg:grid-cols-[1fr_minmax(0,560px)] lg:gap-16 lg:pt-0">
          <div className="order-2 lg:order-1">
            <p className="text-xs opacity-70 sm:text-sm">{t('flowEyebrow')}</p>
            <h2 className="lp-pixel mt-3 text-[clamp(2rem,5vw,4.2rem)] leading-[1]">{t('flowTitle')}</h2>
            <ol className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-4">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={active === i ? 'step' : undefined}
                    className={cn(
                      'w-full text-left transition-opacity duration-200',
                      active === i ? 'opacity-100' : 'opacity-35 hover:opacity-70',
                    )}
                  >
                    <span className="lp-pixel flex items-baseline gap-3 text-xl sm:text-2xl">
                      <span aria-hidden className="text-base">
                        {active === i ? '[■]' : '[ ]'}
                      </span>
                      {s.title}
                    </span>
                    <span
                      className={cn(
                        'ml-9 mt-1 block max-w-[44ch] text-[13px] leading-relaxed transition-[max-height,opacity] duration-300 sm:text-sm',
                        active === i ? 'max-h-24 opacity-100' : 'max-h-0 overflow-hidden opacity-0',
                      )}
                    >
                      {s.body}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="order-1 flex flex-col gap-3 lg:order-2">
            <div className="relative mx-auto aspect-square w-full max-w-[min(560px,46svh)] lg:max-w-[560px]">
              <PixelField
                scenes={FLOW_SCENES}
                progress={stage}
                cell={cell}
                color={INK}
                accent={COBALT}
                radius={8}
                scatter={9}
                label={steps[active]?.title ?? ''}
              />
            </div>
            <p className="mx-auto min-h-5 w-full max-w-[560px] bg-black px-3 py-2 text-xs text-[var(--lp-lime)] sm:text-[13px]">
              {FLOW_CMDS[active]}
              <span className="lp-caret">_</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────── Act IV · developers ─────────────────────────────── */

function Kit() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const typed = useTyped(KIT_CODE, inView)
  const total = KIT_CODE.split('\n').length
  const lines = typed.split('\n')

  return (
    <section id="developers" className="bg-[var(--lp-ink)] text-[var(--lp-bone)]">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:py-28">
        <div>
          <p className="text-xs text-[var(--lp-lime)] sm:text-sm">{`// ${t('kitEyebrow')}`}</p>
          <h2 className="lp-pixel mt-4 max-w-[16ch] text-balance text-[clamp(2rem,4.6vw,3.9rem)] leading-[1.02]">
            {t('kitTitle')}
          </h2>
          <p className="mt-5 max-w-[46ch] text-sm leading-relaxed opacity-75 sm:text-[15px]">{t('kitBody')}</p>
          <div className="mt-8">
            <PixelButton href="/developers">{t('kitCta')}</PixelButton>
          </div>
          <p className="mt-8 max-w-[46ch] text-xs leading-relaxed opacity-55">{t('kitNote')}</p>
        </div>

        <div ref={ref} className="border-2 border-[var(--lp-lime)] shadow-[8px_8px_0_var(--lp-cobalt)]">
          <div className="flex items-center justify-between border-b-2 border-[var(--lp-lime)] px-4 py-2 text-xs text-[var(--lp-lime)]">
            <span>POST /api/v1/claims</span>
            <span className="tabular-nums">
              {Math.min(lines.length, total)}/{total}
            </span>
          </div>
          <pre className="min-h-[19rem] overflow-x-auto p-4 text-[12px] leading-[1.7] sm:text-[13px]">
            <code>
              {lines.map((l, i) => (
                <span key={i} className="block">
                  <span aria-hidden className="mr-4 inline-block w-5 select-none text-right opacity-35">
                    {i + 1}
                  </span>
                  {l}
                  {i === lines.length - 1 && <span className="lp-caret text-[var(--lp-lime)]">█</span>}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────── Act V · proof ──────────────────────────────── */

function Proof() {
  const t = useTranslations('landing')

  const stats = [
    { label: t('proofSettlementLabel'), value: t('proofSettlementValue'), unit: t('proofSettlementUnit') },
    { label: t('proofFeeLabel'), value: t('proofFeeValue'), unit: t('proofFeeUnit') },
    { label: t('proofCapLabel'), value: t('proofCapValue'), unit: t('proofCapUnit') },
    { label: t('proofQuoteLabel'), value: t('proofQuoteValue'), unit: t('proofQuoteUnit') },
  ]
  const corridors = [
    { rail: t('corridorBrlOn'), status: t('corridorLive'), ok: true },
    { rail: t('corridorMxnOn'), status: t('corridorLive'), ok: true },
    { rail: t('corridorBrlOff'), status: t('corridorDown'), ok: false },
    { rail: t('corridorMxnOff'), status: t('corridorLive'), ok: true },
  ]

  return (
    <section id="proof" className="bg-[var(--lp-bone)] text-[var(--lp-cobalt)]">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <p className="text-xs opacity-75 sm:text-sm">{`// ${t('proofEyebrow')}`}</p>
            <h2 className="lp-pixel mt-4 max-w-[16ch] text-balance text-[clamp(2rem,4.6vw,3.9rem)] leading-[1.02]">
              {t('proofTitle')}
            </h2>
            <p className="mt-5 max-w-[46ch] text-sm leading-relaxed opacity-80 sm:text-[15px]">{t('proofBody')}</p>
            <dl className="mt-8 grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="border-2 border-current p-4">
                  <dt className="text-xs opacity-75">{s.label}</dt>
                  <dd className="lp-num mt-2 flex items-baseline gap-1.5 text-4xl tabular-nums sm:text-5xl">
                    {s.value}
                    <span className="text-base">{s.unit}</span>
                    <span aria-hidden className="lp-caret text-2xl">
                      _
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="h-fit border-2 border-current p-5 shadow-[8px_8px_0_var(--lp-cobalt)] sm:p-6">
            <AsciiReceipt />
          </div>
        </div>

        <div className="mt-16 sm:mt-20">
          <h3 className="lp-pixel text-2xl sm:text-3xl">{t('corridorTitle')}</h3>
          <div className="mt-5 border-2 border-current text-sm">
            <div className="hidden grid-cols-[1fr_1.4fr_1.2fr] gap-3 border-b-2 border-current px-4 py-2 text-xs opacity-75 md:grid">
              <span>{t('corridorProvider')}</span>
              <span>{t('corridorRail')}</span>
              <span>{t('corridorStatus')}</span>
            </div>
            {corridors.map((row, i) => (
              <div
                key={row.rail}
                className={cn(
                  'grid gap-1 px-4 py-3 md:grid-cols-[1fr_1.4fr_1.2fr] md:items-center md:gap-3',
                  i > 0 && 'border-t border-current/30',
                )}
              >
                <span className="font-bold">Etherfuse</span>
                <span>{row.rail}</span>
                <span className={cn(!row.ok && 'line-through decoration-2')}>
                  <span aria-hidden>{row.ok ? '[■] ' : '[ ] '}</span>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-[80ch] text-xs leading-relaxed opacity-75">{t('corridorNote')}</p>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────── Finale · cta + footer ─────────────────────────────── */

function FinalCta() {
  const t = useTranslations('landing')
  const cell = useCell(8, 5)
  return (
    <section className="relative flex min-h-[88svh] flex-col overflow-hidden bg-[var(--lp-cobalt)] text-white">
      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-8">
        <h2 className="lp-pixel max-w-[18ch] text-balance text-[clamp(2rem,5vw,4.4rem)] leading-[1]">{t('ctaTitle')}</h2>
        <p className="mt-5 max-w-[46ch] text-sm leading-relaxed opacity-85 sm:text-[15px]">{t('ctaBody')}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-5">
          <PixelButton href="/dashboard" tone="bone">
            {t('ctaCreate')}
          </PixelButton>
          <PixelButton href="/dashboard" variant="line">
            {t('ctaSecondary')}
          </PixelButton>
        </div>
      </div>
      <div className="pointer-events-none relative mt-6 w-full flex-1">
        <PixelField
          scenes={CTA_SCENES}
          cell={cell}
          color={BONE}
          accent={LIME}
          idle="wave"
          radius={12}
          label="VAI E VEM"
        />
      </div>
    </section>
  )
}

function LandingFooter() {
  const t = useTranslations('landing')
  const year = new Date().getFullYear()
  const columns = [
    {
      title: t('footerProduct'),
      links: [
        { label: t('footerHow'), href: '#how-it-works', hash: true },
        { label: t('footerProblem'), href: '#problem', hash: true },
        { label: t('footerProof'), href: '#proof', hash: true },
        { label: t('footerDashboard'), href: '/dashboard' },
      ],
    },
    {
      title: t('footerDevelopers'),
      links: [
        { label: t('footerDocs'), href: '/developers' },
        { label: t('footerApi'), href: '/developers' },
      ],
    },
  ]
  return (
    <footer className="bg-[var(--lp-ink)] text-[var(--lp-bone)]">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-xs">
            <p className="lp-pixel text-3xl text-[var(--lp-lime)]">VAIVÉM</p>
            <p className="mt-4 text-sm leading-relaxed opacity-70">{t('footerBlurb')}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-[var(--lp-lime)]">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'hash' in l ? (
                      <a href={l.href} className="opacity-75 hover:underline hover:opacity-100">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href as '/dashboard'} className="opacity-75 hover:underline hover:opacity-100">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/20 pt-6 text-xs opacity-60 sm:flex-row sm:items-center">
          <p>{t('footerLegal', { year })}</p>
          <p>{t('footerPowered')}</p>
        </div>
      </div>
    </footer>
  )
}
