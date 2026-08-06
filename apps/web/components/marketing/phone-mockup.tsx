'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

export type PhoneScreen = 'claim' | 'unlock' | 'pix' | 'done'

const screens: PhoneScreen[] = ['claim', 'unlock', 'pix', 'done']

export function phoneScreenFromProgress(progress: number): PhoneScreen {
  const p = Math.min(1, Math.max(0, progress))
  const idx = Math.min(screens.length - 1, Math.floor(p * screens.length))
  return screens[idx] ?? 'claim'
}

export function PhoneMockup({
  screen,
  className,
}: {
  screen: PhoneScreen
  className?: string
}) {
  const t = useTranslations('landing')
  const reduce = useReducedMotion()

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[280px] rounded-[2rem] bg-foreground p-2 shadow-none sm:max-w-[300px]',
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.5rem] bg-background">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <Logo showWordmark={false} className="h-6 w-auto dark:invert-0" />
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t('phoneSecure')}
          </span>
        </div>

        <div className="relative min-h-[380px] px-4 pb-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col"
            >
              {screen === 'claim' ? <ScreenClaim /> : null}
              {screen === 'unlock' ? <ScreenUnlock /> : null}
              {screen === 'pix' ? <ScreenPix /> : null}
              {screen === 'done' ? <ScreenDone /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ScreenClaim() {
  const t = useTranslations('landing')
  return (
    <>
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">{t('phoneReceived')}</p>
        <p className="mt-1 text-3xl font-semibold tracking-[-0.02em] tabular-nums">
          {t('phoneAmount')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('phoneApprox')}</p>
      </div>
      <div className="mt-6 rounded-[1.25rem] bg-surface p-3 dark:border dark:border-border">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('phoneFrom')}</span>
          <span className="font-medium">{t('phoneSender')}</span>
        </div>
      </div>
      <div className="mt-4 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        {t('phoneClaimCta')}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {t('phoneClaimHint')}
      </p>
    </>
  )
}

function ScreenUnlock() {
  const t = useTranslations('landing')
  return (
    <>
      <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em]">
        {t('phoneUnlockTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{t('phoneUnlockBody')}</p>
      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="flex size-9 items-center justify-center rounded-xl bg-surface font-mono text-sm dark:border dark:border-border"
          >
            {i < 3 ? '•' : ''}
          </span>
        ))}
      </div>
      <div className="mt-8 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        {t('phoneUnlockCta')}
      </div>
    </>
  )
}

function ScreenPix() {
  const t = useTranslations('landing')
  return (
    <>
      <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em]">
        {t('phonePixTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{t('phonePixBody')}</p>
      <div className="mt-6 rounded-full bg-surface px-4 py-3 font-mono text-xs text-muted-foreground dark:border dark:border-border">
        ana@email.com
      </div>
      <p className="mt-4 text-center text-2xl font-semibold tabular-nums tracking-[-0.02em]">
        {t('phoneAmount')}
      </p>
      <div className="mt-6 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        {t('phonePixCta')}
      </div>
    </>
  )
}

function ScreenDone() {
  const t = useTranslations('landing')
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
        ✓
      </span>
      <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em]">
        {t('phoneDoneTitle')}
      </h3>
      <p className="mt-2 max-w-[14rem] text-sm text-muted-foreground">
        {t('phoneDoneBody')}
      </p>
      <p className="mt-6 text-2xl font-semibold tabular-nums tracking-[-0.02em]">
        {t('phoneAmount')}
      </p>
    </div>
  )
}
