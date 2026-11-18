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
import { Logo } from '@/components/logo'
import { LandingNav } from '@/components/marketing/landing-nav'
import { PixelField } from '@/components/marketing/pixel-field'
import { AsciiReceipt, useTyped } from '@/components/marketing/ascii'
import {
  coinScene,
  fade,
  linkScene,
  pixScene,
  slabsScene,
  wordScene,
} from '@/components/marketing/pixel-scenes'

const LIME = '#d4ff3f'
const LIME_DIM = '#78941f'
const LINE = 'border-[var(--lp-line)]'

const HERO_SCENES = [slabsScene]
const FLOW_SCENES = [coinScene, linkScene, pixScene]
const CTA_SCENES = [fade(wordScene('vaivem', { zone: 'cta-word', fill: 0.97, weight: 800 }), { from: 0.55, floor: 0.22 })]

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

/** Smaller cells on phones so shapes keep their detail. */
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

/** Page column framed by hairlines, like a spec sheet. */
function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[1240px] border-x', LINE, className)}>{children}</div>
  )
}

function Cross({ className }: { className?: string }) {
  return <span aria-hidden className={cn('lp-cross z-10', className)} />
}

function Button({
  href,
  children,
  variant = 'solid',
}: {
  href: string
  children: ReactNode
  variant?: 'solid' | 'line'
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition-[background-color,filter]',
        variant === 'solid'
          ? 'bg-[var(--lp-lime)] text-black hover:brightness-95'
          : 'border border-[var(--lp-line-strong)] hover:bg-white/5',
      )}
    >
      {children}
    </Link>
  )
}

export function LandingPage() {
  return (
    <div className="lp min-h-screen overflow-x-clip">
      <LandingNav />
      <main>
        <Hero />
        <Problem />
        <Flow />
        <Kit />
        <Proof />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}

/* ─────────────────────────────────── hero ─────────────────────────────────── */

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="lp-label">{label}</p>
      <p className="lp-mono mt-1.5 text-xl tabular-nums sm:text-2xl">
        {value}
        <span className="ml-1 text-sm text-[var(--lp-muted)]">{unit}</span>
        <span aria-hidden className="lp-caret text-[var(--lp-lime)]">
          _
        </span>
      </p>
    </div>
  )
}

function Hero() {
  const t = useTranslations('landing')
  const cell = useCell(5, 4)

  return (
    <section className="pt-14">
      <Rail>
        <Cross className="-left-[5px] top-0" />
        <Cross className="-right-[5px] top-0" />

        <div className="grid lg:grid-cols-2">
          <div className={cn('lp-hatch flex flex-col justify-center px-5 py-16 sm:px-10 lg:min-h-[640px] lg:border-r', LINE)}>
            <span className="lp-tag w-fit">
              {t('heroChip')}
              <span aria-hidden className="lp-caret">
                _
              </span>
            </span>
            <h1 className="lp-h mt-7 max-w-[15ch] text-[clamp(2.5rem,5.2vw,4.6rem)]">{t('heroTitle')}</h1>
            <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-[var(--lp-muted)] sm:text-base">
              {t('heroBody')}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/dashboard">{t('ctaCreate')}</Button>
              <Button href="/developers" variant="line">
                {t('ctaDevelopers')}
              </Button>
            </div>
            <p className="mt-6 text-xs text-[var(--lp-muted)]">{t('heroAside')}</p>
          </div>

          <div className={cn('relative min-h-[360px] border-t lg:min-h-[640px] lg:border-t-0', LINE)}>
            <PixelField
              scenes={HERO_SCENES}
              cell={cell}
              dot={0.62}
              color={LIME}
              accent={LIME_DIM}
              accentEvery={4}
              idle="wave"
              wave={0.5}
              radius={7}
              maxParticles={7500}
              label={t('heroChip')}
            />
            <span className="lp-tag absolute left-4 top-4">{t('statusTag')}</span>
            <span aria-hidden className="lp-mono absolute right-4 top-4 text-[11px] tracking-[0.2em] text-[var(--lp-muted)]">
              ||||||||||||
            </span>
            <p className="lp-label absolute bottom-4 left-4 hidden normal-case tracking-normal lg:block">
              {t('heroHint')}
            </p>
          </div>
        </div>

        <div className={cn('grid border-t lg:grid-cols-2', LINE)}>
          <div className={cn('flex flex-col justify-center gap-3 px-5 py-5 sm:px-10 lg:border-r', LINE)}>
            <p className="lp-label">{t('logos')}</p>
            <p className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[15px] font-medium tracking-[-0.01em] text-[var(--lp-muted)]">
              <span>Stellar</span>
              <span>USDC</span>
              <span>Etherfuse</span>
              <span>PIX</span>
              <span>SPEI</span>
            </p>
          </div>
          <div className={cn('grid grid-cols-3 divide-x border-t lg:border-t-0', LINE, 'divide-[var(--lp-line)]')}>
            <Stat label={t('proofSettlementLabel')} value={t('proofSettlementValue')} unit={t('proofSettlementUnit')} />
            <Stat label={t('proofFeeLabel')} value={t('proofFeeValue')} unit={t('proofFeeUnit')} />
            <Stat label={t('proofQuoteLabel')} value={t('proofQuoteValue')} unit={t('proofQuoteUnit')} />
          </div>
        </div>
      </Rail>
    </section>
  )
}

/* ───────────────────────────────── the problem ───────────────────────────────── */

const BAR = 28

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
    <div className={cn('border bg-[var(--lp-panel)] p-5', tone === 'new' ? 'border-[rgba(212,255,63,0.4)]' : LINE)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="lp-label">{label}</span>
        <span className={cn('lp-mono text-lg tabular-nums', tone === 'new' && 'text-[var(--lp-lime)]')}>{time}</span>
      </div>
      <p
        aria-hidden
        className={cn(
          'lp-mono mt-4 whitespace-pre text-[13px] leading-none tracking-[-0.05em] sm:text-sm',
          tone === 'new' ? 'text-[var(--lp-lime)]' : 'text-[var(--lp-muted)]',
        )}
      >
        {'█'.repeat(filled)}
        <span className="opacity-30">{'░'.repeat(BAR - filled)}</span>
      </p>
      <ul className="mt-5 flex min-h-[3.4rem] flex-col gap-1.5 text-[13px]">
        {rows.map((r) => (
          <li
            key={r.text}
            className={cn(
              'flex gap-2 transition-opacity duration-200',
              r.shown ? 'opacity-100' : 'opacity-0',
              r.ok ? 'text-[var(--lp-text)]' : 'text-[var(--lp-muted)]',
            )}
          >
            <span aria-hidden className={cn('lp-mono', r.ok && 'text-[var(--lp-lime)]')}>
              {r.ok ? '+' : '×'}
            </span>
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
  useMotionValueEvent(scrollYProgress, 'change', (v) => setStep(Math.round(clamp01((v - 0.1) / 0.78) * BAR)))

  const days = Math.floor((step / BAR) * 5)
  return (
    <section id="problem" ref={ref} className={cn('relative h-[240vh] border-t', LINE)}>
      <div className="sticky top-0 flex h-[100svh] items-center pt-14">
        <Rail className="w-full">
          <div className="grid items-center gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[1fr_minmax(0,540px)] lg:gap-16">
            <div>
              <p className="lp-label">{t('problemEyebrow')}</p>
              <h2 className="lp-h mt-4 max-w-[19ch] text-[clamp(2rem,4.2vw,3.5rem)]">{t('problemTitle')}</h2>
              <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-[var(--lp-muted)]">{t('problemBody')}</p>
              <p className="lp-label mt-8 hidden normal-case tracking-normal lg:block">
                {t('problemHint')}
                <span className="lp-caret text-[var(--lp-lime)]">_</span>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Lane
                tone="old"
                label={t('problemBeforeLabel')}
                time={step >= BAR ? t('problemBeforeDays') : `D+${days}`}
                filled={step}
                rows={[
                  { text: t('problemBeforeFees'), shown: step >= 9, ok: false },
                  { text: t('problemBeforeForms'), shown: step >= 18, ok: false },
                ]}
              />
              <Lane
                tone="new"
                label={t('problemAfterLabel')}
                time={step >= 3 ? t('problemAfterDays') : '…'}
                filled={Math.min(BAR, step * 9)}
                rows={[
                  { text: t('problemAfterFees'), shown: step >= 3, ok: true },
                  { text: t('problemAfterForms'), shown: step >= 4, ok: true },
                ]}
              />
            </div>
          </div>
        </Rail>
      </div>
    </section>
  )
}

/* ───────────────────────────────── how it works ───────────────────────────────── */

const FLOW_CMDS = [
  '$ vaivem send 500 --to ana',
  '> ana opened ://vaivem/c/7KQ2  [verified]',
  '> pix R$500,00 --> ana@bank  [settled]',
]

function Flow() {
  const t = useTranslations('landing')
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const cell = useCell(5, 4)
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
    <section id="how-it-works" ref={ref} className={cn('relative h-[320vh] border-t', LINE)}>
      <div className="sticky top-0 flex h-[100svh] items-center pt-14">
        <Rail className="w-full">
          <div className="grid items-center gap-8 px-5 py-8 sm:px-10 lg:grid-cols-[1fr_minmax(0,540px)] lg:gap-16">
            <div className="order-2 lg:order-1">
              <p className="lp-label">{t('flowEyebrow')}</p>
              <h2 className="lp-h mt-4 text-[clamp(2rem,4.2vw,3.5rem)]">{t('flowTitle')}</h2>
              <ol className={cn('mt-8 border-t', LINE)}>
                {steps.map((s, i) => (
                  <li key={s.title} className={cn('border-b', LINE)}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={active === i ? 'step' : undefined}
                      className={cn(
                        'relative flex w-full gap-5 py-4 text-left transition-opacity duration-200',
                        active === i ? 'opacity-100' : 'opacity-45 hover:opacity-75',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-0 top-0 h-full w-px transition-colors',
                          active === i ? 'bg-[var(--lp-lime)]' : 'bg-transparent',
                        )}
                      />
                      <span
                        className={cn(
                          'lp-mono w-6 pl-3 text-xs',
                          active === i ? 'text-[var(--lp-lime)]' : 'text-[var(--lp-muted)]',
                        )}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1">
                        <span className="block text-lg font-medium tracking-[-0.02em]">{s.title}</span>
                        <span
                          className={cn(
                            'block max-w-[44ch] overflow-hidden text-sm leading-relaxed text-[var(--lp-muted)] transition-[max-height,opacity,margin] duration-300',
                            active === i ? 'mt-1.5 max-h-24 opacity-100' : 'max-h-0 opacity-0',
                          )}
                        >
                          {s.body}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            <div className={cn('lp-hatch relative order-1 border lg:order-2', LINE)}>
              <Cross className="-left-[6px] -top-[6px]" />
              <Cross className="-right-[6px] -top-[6px]" />
              <Cross className="-bottom-[6px] -left-[6px]" />
              <Cross className="-bottom-[6px] -right-[6px]" />
              <div className="relative mx-auto aspect-square w-full max-w-[min(540px,44svh)] lg:max-w-none">
                <PixelField
                  scenes={FLOW_SCENES}
                  progress={stage}
                  cell={cell}
                  color={LIME}
                  accent={LIME_DIM}
                  accentEvery={4}
                  radius={7}
                  scatter={8}
                  maxParticles={5000}
                  label={steps[active]?.title ?? ''}
                />
                <span className="lp-tag absolute left-3 top-3">
                  {t('stepOf')} {String(active + 1).padStart(2, '0')} / 03
                </span>
              </div>
              <p className={cn('lp-mono border-t bg-[var(--lp-panel)] px-4 py-2.5 text-xs text-[var(--lp-muted)]', LINE)}>
                {FLOW_CMDS[active]}
                <span className="lp-caret text-[var(--lp-lime)]">_</span>
              </p>
            </div>
          </div>
        </Rail>
      </div>
    </section>
  )
}

/* ───────────────────────────────── developers ───────────────────────────────── */

/** Light syntax tint: strings in lime, keywords in full white, the rest muted. */
function CodeLine({ line }: { line: string }) {
  const parts = line.split(/("[^"]*"|`[^`]*`)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^["`]/.test(p) ? (
          <span key={i} className="text-[var(--lp-lime)]">
            {p}
          </span>
        ) : (
          <span key={i}>
            {p.split(/\b(const|await|fetch|JSON)\b/g).map((q, j) =>
              /^(const|await|fetch|JSON)$/.test(q) ? (
                <span key={j} className="text-white">
                  {q}
                </span>
              ) : (
                q
              ),
            )}
          </span>
        ),
      )}
    </>
  )
}

function Kit() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const typed = useTyped(KIT_CODE, inView)
  const total = KIT_CODE.split('\n').length
  const lines = typed.split('\n')

  return (
    <section id="developers" className={cn('border-t', LINE)}>
      <Rail>
        <div className="grid items-center gap-10 px-5 py-20 sm:px-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:py-28">
          <div>
            <p className="lp-label">{t('kitEyebrow')}</p>
            <h2 className="lp-h mt-4 max-w-[15ch] text-[clamp(2rem,4.2vw,3.5rem)]">{t('kitTitle')}</h2>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-[var(--lp-muted)]">{t('kitBody')}</p>
            <div className="mt-8">
              <Button href="/developers">{t('kitCta')}</Button>
            </div>
            <p className="mt-8 max-w-[44ch] text-xs leading-relaxed text-[var(--lp-muted)]">{t('kitNote')}</p>
          </div>

          <div ref={ref} className={cn('border bg-[var(--lp-panel)]', LINE)}>
            <div className={cn('flex items-center justify-between border-b px-4 py-2.5', LINE)}>
              <span className="lp-label">POST /api/v1/claims</span>
              <span className="lp-label tabular-nums">
                {Math.min(lines.length, total)}/{total}
              </span>
            </div>
            <pre className="lp-mono min-h-[19rem] overflow-x-auto p-4 text-[12px] leading-[1.75] text-[var(--lp-muted)] sm:text-[13px]">
              <code>
                {lines.map((l, i) => (
                  <span key={i} className="block">
                    <span aria-hidden className="mr-4 inline-block w-5 select-none text-right opacity-40">
                      {i + 1}
                    </span>
                    <CodeLine line={l} />
                    {i === lines.length - 1 && <span className="lp-caret text-[var(--lp-lime)]">█</span>}
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </Rail>
    </section>
  )
}

/* ──────────────────────────────────── proof ──────────────────────────────────── */

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
    <section id="proof" className={cn('border-t', LINE)}>
      <Rail>
        <div className="grid gap-12 px-5 py-20 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div>
            <p className="lp-label">{t('proofEyebrow')}</p>
            <h2 className="lp-h mt-4 max-w-[15ch] text-[clamp(2rem,4.2vw,3.5rem)]">{t('proofTitle')}</h2>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-[var(--lp-muted)]">{t('proofBody')}</p>
            <dl className={cn('mt-9 grid grid-cols-2 border-l border-t', LINE)}>
              {stats.map((s) => (
                <div key={s.label} className={cn('border-b border-r p-4 sm:p-5', LINE)}>
                  <dt className="lp-label">{s.label}</dt>
                  <dd className="lp-mono mt-2 text-3xl tabular-nums sm:text-4xl">
                    {s.value}
                    <span className="ml-1.5 text-sm text-[var(--lp-muted)]">{s.unit}</span>
                    <span aria-hidden className="lp-caret text-[var(--lp-lime)]">
                      _
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={cn('h-fit border bg-[var(--lp-panel)] p-5 sm:p-6', LINE)}>
            <AsciiReceipt />
          </div>
        </div>

        <div className={cn('border-t px-5 py-14 sm:px-10', LINE)}>
          <h3 className="text-xl font-medium tracking-[-0.02em]">{t('corridorTitle')}</h3>
          <div className={cn('mt-6 border text-sm', LINE)}>
            <div className={cn('lp-label hidden grid-cols-[1fr_1.4fr_1.2fr] gap-3 border-b px-4 py-2.5 md:grid', LINE)}>
              <span>{t('corridorProvider')}</span>
              <span>{t('corridorRail')}</span>
              <span>{t('corridorStatus')}</span>
            </div>
            {corridors.map((row, i) => (
              <div
                key={row.rail}
                className={cn(
                  'grid gap-1 px-4 py-3.5 md:grid-cols-[1fr_1.4fr_1.2fr] md:items-center md:gap-3',
                  i > 0 && cn('border-t', LINE),
                )}
              >
                <span className="font-medium">Etherfuse</span>
                <span className="text-[var(--lp-muted)]">{row.rail}</span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn('size-1.5 rounded-full', row.ok ? 'bg-[var(--lp-lime)]' : 'bg-[#ff6b5e]')}
                  />
                  {row.status}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-[80ch] text-xs leading-relaxed text-[var(--lp-muted)]">{t('corridorNote')}</p>
        </div>
      </Rail>
    </section>
  )
}

/* ──────────────────────────────── closing + footer ──────────────────────────────── */

function FinalCta() {
  const t = useTranslations('landing')
  const cell = useCell(5, 3)
  return (
    <section className={cn('relative overflow-hidden border-t', LINE)}>
      <div className="pointer-events-none absolute inset-0">
        <PixelField
          scenes={CTA_SCENES}
          cell={cell}
          dot={0.62}
          color={LIME}
          accent={LIME_DIM}
          accentEvery={4}
          idle="wave"
          wave={0.4}
          radius={8}
          maxParticles={7500}
          label="vaivem"
        />
      </div>
      <Rail className="flex min-h-[640px] flex-col border-transparent">
        <div className="relative z-10 px-5 pt-20 sm:px-10 lg:pt-28">
          <h2 className="lp-h max-w-[16ch] text-[clamp(2.2rem,5vw,4.4rem)]">{t('ctaTitle')}</h2>
          <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-[var(--lp-muted)]">{t('ctaBody')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/dashboard">{t('ctaCreate')}</Button>
            <Button href="/dashboard" variant="line">
              {t('ctaSecondary')}
            </Button>
          </div>
        </div>
        <div id="cta-word" aria-hidden className="mt-12 min-h-[220px] flex-1" />
      </Rail>
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
    <footer className={cn('border-t', LINE)}>
      <Rail>
        <div className="grid gap-10 px-5 py-14 sm:px-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo className="h-7 invert sm:h-7" />
            <p className="mt-3 text-sm leading-relaxed text-[var(--lp-muted)]">{t('footerBlurb')}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="lp-label">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'hash' in l ? (
                      <a href={l.href} className="text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-text)]">
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href as '/dashboard'}
                        className="text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-text)]"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className={cn(
            'flex flex-col items-start justify-between gap-3 border-t px-5 py-5 text-xs text-[var(--lp-muted)] sm:flex-row sm:items-center sm:px-10',
            LINE,
          )}
        >
          <p>{t('footerLegal', { year })}</p>
          <p>{t('footerPowered')}</p>
        </div>
      </Rail>
    </footer>
  )
}
