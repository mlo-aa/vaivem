'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

export type PhoneScreen = 'claim' | 'unlock' | 'pix' | 'done'

export function PhoneMockup({
  screen,
  size = 'md',
  className,
}: {
  screen: PhoneScreen
  size?: 'sm' | 'md'
  className?: string
}) {
  const t = useTranslations('landing')
  const reduce = useReducedMotion()
  const compact = size === 'sm'

  return (
    <div
      className={cn(
        'mx-auto w-full select-none bg-foreground',
        compact
          ? 'max-w-[200px] rounded-[1.6rem] p-[8px]'
          : 'max-w-[260px] rounded-[2rem] p-[10px] sm:max-w-[280px]',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.4rem] bg-background">
        {/* Notch */}
        <div
          className={cn(
            'pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-foreground/90',
            compact ? 'h-4 w-20' : 'h-5 w-24',
          )}
        />

        <div
          className={cn(
            'flex items-center justify-between px-4 pb-2',
            compact ? 'pt-7' : 'pt-9',
          )}
        >
          <Logo showWordmark={false} className={cn('w-auto', compact ? 'h-4' : 'h-5')} />
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border dark:border-border">
            {t('phoneSecure')}
          </span>
        </div>

        {/* Fixed height so screen swaps don't jump layout */}
        <div
          className={cn(
            'relative px-4 pb-5',
            compact ? 'h-[260px]' : 'h-[340px]',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-x-4 top-0 bottom-5 flex flex-col"
            >
              {screen === 'claim' ? <ScreenClaim compact={compact} /> : null}
              {screen === 'unlock' ? <ScreenUnlock compact={compact} /> : null}
              {screen === 'pix' ? <ScreenPix compact={compact} /> : null}
              {screen === 'done' ? <ScreenDone compact={compact} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ScreenClaim({ compact }: { compact?: boolean }) {
  const t = useTranslations('landing')
  return (
    <>
      <div className="mt-2 text-center">
        <p className="text-xs text-muted-foreground">{t('phoneReceived')}</p>
        <p
          className={cn(
            'mt-1 font-semibold tracking-[-0.02em] tabular-nums',
            compact ? 'text-2xl' : 'text-3xl',
          )}
        >
          {t('phoneAmount')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('phoneApprox')}</p>
      </div>
      <div
        className={cn(
          'rounded-[1.25rem] bg-surface p-3 dark:border dark:border-border',
          compact ? 'mt-4' : 'mt-6',
        )}
      >
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('phoneFrom')}</span>
          <span className="font-medium">{t('phoneSender')}</span>
        </div>
      </div>
      <div className="mt-auto rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        {t('phoneClaimCta')}
      </div>
      {!compact ? (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {t('phoneClaimHint')}
        </p>
      ) : null}
    </>
  )
}

function ScreenUnlock({ compact }: { compact?: boolean }) {
  const t = useTranslations('landing')
  return (
    <>
      <h3
        className={cn(
          'mt-2 font-semibold tracking-[-0.02em]',
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {t('phoneUnlockTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{t('phoneUnlockBody')}</p>
      <div className={cn('flex justify-center gap-1.5', compact ? 'mt-5' : 'mt-8')}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'flex items-center justify-center rounded-lg bg-surface font-mono text-sm dark:border dark:border-border',
              compact ? 'size-7' : 'size-8 sm:size-9',
            )}
          >
            {i < 3 ? '•' : ''}
          </span>
        ))}
      </div>
      <div className="mt-auto rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        {t('phoneUnlockCta')}
      </div>
    </>
  )
}

function ScreenPix({ compact }: { compact?: boolean }) {
  const t = useTranslations('landing')
  return (
    <>
      <h3
        className={cn(
          'mt-2 font-semibold tracking-[-0.02em]',
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {t('phonePixTitle')}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{t('phonePixBody')}</p>
      <div
        className={cn(
          'rounded-full bg-surface px-4 py-3 font-mono text-xs text-muted-foreground dark:border dark:border-border',
          compact ? 'mt-4' : 'mt-6',
        )}
      >
        ana@email.com
      </div>
      <p
        className={cn(
          'text-center font-semibold tabular-nums tracking-[-0.02em]',
          compact ? 'mt-4 text-xl' : 'mt-6 text-2xl',
        )}
      >
        {t('phoneAmount')}
      </p>
      <div className="mt-auto rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        {t('phonePixCta')}
      </div>
    </>
  )
}

function ScreenDone({ compact }: { compact?: boolean }) {
  const t = useTranslations('landing')
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
          compact ? 'size-11 text-lg' : 'size-14 text-xl',
        )}
      >
        ✓
      </span>
      <h3
        className={cn(
          'font-semibold tracking-[-0.02em]',
          compact ? 'mt-4 text-lg' : 'mt-5 text-xl',
        )}
      >
        {t('phoneDoneTitle')}
      </h3>
      <p className="mt-2 max-w-[14rem] text-sm text-muted-foreground">
        {t('phoneDoneBody')}
      </p>
      <p
        className={cn(
          'font-semibold tabular-nums tracking-[-0.02em]',
          compact ? 'mt-4 text-xl' : 'mt-6 text-2xl',
        )}
      >
        {t('phoneAmount')}
      </p>
    </div>
  )
}
