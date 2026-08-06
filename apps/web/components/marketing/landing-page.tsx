'use client'

import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ui/button-link'
import { MarketingHeader } from '@/components/marketing/marketing-header'
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import {
  CountUp,
  FadeIn,
  Stagger,
  StaggerItem,
  Typewriter,
} from '@/components/marketing/landing-motion'
import {
  PhoneMockup,
  phoneScreenFromProgress,
  type PhoneScreen,
} from '@/components/marketing/phone-mockup'
import { cn } from '@/lib/utils'

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

export function LandingPage() {
  const t = useTranslations('landing')

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <Hero />
        <Problem />
        <Flow />
        <Kit />
        <Proof />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  )
}

function Hero() {
  const t = useTranslations('landing')
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--surface)_0%,var(--background)_55%)]"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:py-24">
        <FadeIn>
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground dark:border dark:border-border">
            <span className="size-1.5 rounded-full bg-primary" />
            {t('heroEyebrow')}
          </span>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
            {t('heroBody')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink size="lg" href="/dashboard">
              {t('ctaCreate')}
              <ArrowRight data-icon="inline-end" />
            </ButtonLink>
            <ButtonLink size="lg" variant="secondary" href="/claim/demo-active">
              {t('ctaDemo')}
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t('heroAside')}</p>
        </FadeIn>

        <FadeIn delay={0.08} className="flex justify-center lg:justify-end">
          <motion.div
            animate={
              reduce
                ? undefined
                : { y: [0, -6, 0] }
            }
            transition={
              reduce
                ? undefined
                : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <PhoneMockup screen="claim" />
          </motion.div>
        </FadeIn>
      </div>
    </section>
  )
}

function Problem() {
  const t = useTranslations('landing')

  return (
    <section id="problem" className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-20">
        <FadeIn className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('problemEyebrow')}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t('problemTitle')}
          </h2>
          <p className="mt-3 text-pretty text-[15px] text-muted-foreground">
            {t('problemBody')}
          </p>
        </FadeIn>

        <Stagger className="mt-10 grid gap-4 md:grid-cols-2">
          <StaggerItem>
            <div className="rounded-[1.25rem] bg-background p-6 dark:border dark:border-border">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('problemBeforeLabel')}
              </p>
              <ul className="mt-4 space-y-3 text-[15px]">
                <li className="flex justify-between gap-4 border-b border-transparent pb-3 dark:border-border">
                  <span className="text-muted-foreground">{t('problemBeforeDays')}</span>
                  <span className="font-medium tabular-nums text-destructive">2–5d</span>
                </li>
                <li className="text-muted-foreground">{t('problemBeforeFees')}</li>
                <li className="text-muted-foreground">{t('problemBeforeForms')}</li>
              </ul>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-[1.25rem] bg-primary p-6 text-primary-foreground">
              <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/70">
                {t('problemAfterLabel')}
              </p>
              <ul className="mt-4 space-y-3 text-[15px]">
                <li className="flex justify-between gap-4 border-b border-primary-foreground/15 pb-3">
                  <span className="text-primary-foreground/80">{t('problemAfterDays')}</span>
                  <span className="font-semibold tabular-nums">~5 min</span>
                </li>
                <li className="text-primary-foreground/80">{t('problemAfterFees')}</li>
                <li className="text-primary-foreground/80">{t('problemAfterForms')}</li>
              </ul>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  )
}

function Flow() {
  const t = useTranslations('landing')
  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  })
  const phoneY = useTransform(scrollYProgress, [0, 1], [12, -12])
  const [screen, setScreen] = useState<PhoneScreen>('claim')

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduce) return
    setScreen(phoneScreenFromProgress(v))
  })

  const steps = [
    { title: t('flowStep1Title'), body: t('flowStep1Body'), screen: 'claim' as const },
    { title: t('flowStep2Title'), body: t('flowStep2Body'), screen: 'unlock' as const },
    { title: t('flowStep3Title'), body: t('flowStep3Body'), screen: 'pix' as const },
  ]

  return (
    <section id="how-it-works" ref={containerRef} className="relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <FadeIn className="max-w-2xl py-14 lg:py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('flowEyebrow')}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t('flowTitle')}
          </h2>
          <p className="mt-3 text-pretty text-[15px] text-muted-foreground">
            {t('flowBody')}
          </p>
        </FadeIn>

        <div className="space-y-12 pb-16 lg:hidden">
          {steps.map((step, i) => (
            <FlowStepMobile
              key={step.title}
              index={i}
              title={step.title}
              body={step.body}
              screen={step.screen}
            />
          ))}
          <div className="flex justify-center pt-4">
            <PhoneMockup screen="done" />
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-16 lg:pb-32">
          <div className="space-y-[30vh] pb-[20vh]">
            {steps.map((step, i) => (
              <div key={step.title} className="flex min-h-[50vh] items-center">
                <FadeIn>
                  <p className="font-mono text-sm text-muted-foreground">0{i + 1}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </FadeIn>
              </div>
            ))}
            <div className="flex min-h-[40vh] items-center">
              <FadeIn>
                <p className="font-mono text-sm text-muted-foreground">04</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                  {t('phoneDoneTitle')}
                </h3>
                <p className="mt-3 max-w-sm text-[15px] text-muted-foreground">
                  {t('phoneDoneBody')}
                </p>
              </FadeIn>
            </div>
          </div>
          <div className="relative">
            <div className="sticky top-28 flex justify-center py-8">
              <motion.div style={reduce ? undefined : { y: phoneY }}>
                <PhoneMockup screen={reduce ? 'claim' : screen} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FlowStepMobile({
  index,
  title,
  body,
  screen,
}: {
  index: number
  title: string
  body: string
  screen: PhoneScreen
}) {
  return (
    <FadeIn className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">0{index + 1}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="mt-2 text-[15px] text-muted-foreground">{body}</p>
      </div>
      <PhoneMockup screen={screen} />
    </FadeIn>
  )
}

function Kit() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.35, once: true })

  return (
    <section
      id="developers"
      ref={ref}
      className="bg-foreground text-background"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
        <FadeIn>
          <span className="inline-flex items-center gap-2 rounded-full bg-background/10 px-3 py-1 text-xs font-medium text-background/70">
            {t('kitEyebrow')}
          </span>
          <h2 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t('kitTitle')}
          </h2>
          <p className="mt-4 max-w-md text-pretty leading-relaxed text-background/70">
            {t('kitBody')}
          </p>
          <p className="mt-3 max-w-md text-sm text-background/50">{t('kitNote')}</p>
          <ButtonLink className="mt-8" href="/developers">
            {t('kitCta')}
            <ArrowRight data-icon="inline-end" />
          </ButtonLink>
        </FadeIn>
        <FadeIn delay={0.06}>
          <div className="rounded-[1.25rem] bg-background/10 p-1.5">
            <div className="flex items-center gap-1.5 px-3 py-2.5">
              <span className="size-2.5 rounded-full bg-background/20" />
              <span className="size-2.5 rounded-full bg-background/20" />
              <span className="size-2.5 rounded-full bg-background/20" />
            </div>
            <Typewriter
              text={KIT_CODE}
              active={inView}
              className="overflow-x-auto rounded-[1rem] bg-background/15 p-5 font-mono text-xs leading-relaxed text-background/90 sm:text-sm"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function Proof() {
  const t = useTranslations('landing')

  const stats = [
    {
      label: t('proofSettlementLabel'),
      value: 5,
      unit: t('proofSettlementUnit'),
      prefix: '1–',
    },
    {
      label: t('proofFeeLabel'),
      value: 20,
      unit: t('proofFeeUnit'),
      prefix: '',
    },
    {
      label: t('proofCapLabel'),
      value: 500,
      unit: t('proofCapUnit'),
      prefix: '',
    },
    {
      label: t('proofQuoteLabel'),
      value: 120,
      unit: t('proofQuoteUnit'),
      prefix: '',
    },
  ]

  const corridors = [
    { rail: t('corridorBrlOn'), status: t('corridorLive'), live: true },
    { rail: t('corridorMxnOn'), status: t('corridorLive'), live: true },
    { rail: t('corridorBrlOff'), status: t('corridorLive'), live: true },
    { rail: t('corridorMxnOff'), status: t('corridorLive'), live: true },
  ]

  return (
    <section id="proof" className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-20">
        <FadeIn className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('proofEyebrow')}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {t('proofTitle')}
          </h2>
          <p className="mt-3 text-pretty text-[15px] text-muted-foreground">
            {t('proofBody')}
          </p>
        </FadeIn>

        <Stagger className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div className="rounded-[1.25rem] bg-surface p-5 dark:border dark:border-border">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] tabular-nums sm:text-4xl">
                  {s.prefix ? (
                    <>
                      {s.prefix}
                      <CountUp to={s.value} />
                    </>
                  ) : (
                    <CountUp to={s.value} />
                  )}
                  <span className="ml-1 text-base font-medium text-muted-foreground">
                    {s.unit}
                  </span>
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <FadeIn className="mt-10">
          <h3 className="text-lg font-semibold tracking-[-0.02em]">
            {t('corridorTitle')}
          </h3>
          <div className="mt-4 overflow-hidden rounded-[1.25rem] bg-surface dark:border dark:border-border">
            <div className="hidden grid-cols-[1fr_1.2fr_1fr] gap-2 border-b border-transparent px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid dark:border-border">
              <span>{t('corridorProvider')}</span>
              <span>{t('corridorRail')}</span>
              <span>{t('corridorStatus')}</span>
            </div>
            {corridors.map((row) => (
              <div
                key={row.rail}
                className={cn(
                  'grid gap-1 border-t border-transparent px-5 py-4 text-sm dark:border-border md:grid-cols-[1fr_1.2fr_1fr] md:items-center md:gap-2',
                )}
              >
                <span className="font-medium">Etherfuse</span>
                <span className="text-muted-foreground">{row.rail}</span>
                <span
                  className={cn(
                    'text-xs font-medium md:text-sm',
                    row.live ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function FinalCta() {
  const t = useTranslations('landing')
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-20">
        <FadeIn>
          <div className="flex flex-col items-center gap-6 rounded-[1.5rem] bg-primary px-6 py-12 text-center text-primary-foreground">
            <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              {t('ctaTitle')}
            </h2>
            <p className="max-w-md text-pretty text-primary-foreground/80">
              {t('ctaBody')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                size="lg"
                href="/dashboard"
                className="bg-foreground text-background hover:opacity-90"
              >
                {t('ctaCreate')}
                <ArrowRight data-icon="inline-end" />
              </ButtonLink>
              <ButtonLink
                size="lg"
                variant="secondary"
                href="/dashboard"
                className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
              >
                {t('ctaSecondary')}
              </ButtonLink>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
