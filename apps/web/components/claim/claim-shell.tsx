'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'

/**
 * Recipient chrome for /claim/* — light mode only (forced via ThemeProvider), bank-like.
 * Same type scale and card system as sender; no theme toggle.
 */
export function ClaimShell({ children }: { children: ReactNode }) {
  const t = useTranslations('claim')
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-start justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-2.5">
          <Logo />
          <div className="flex flex-wrap gap-2">
            {demoMode ? (
              <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {t('demo')}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {t('onlyForYou')}
            </span>
          </div>
        </div>
        <LanguageSwitcher compact />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-20 pt-4 sm:items-center sm:px-8 sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
