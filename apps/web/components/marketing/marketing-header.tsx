'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ui/button-link'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export function MarketingHeader() {
  const t = useTranslations('landing')
  const [open, setOpen] = useState(false)

  const NAV = [
    { label: t('navHow'), href: '/#how-it-works' as const },
    { label: t('navUseCases'), href: '/#use-cases' as const },
    { label: t('navDevelopers'), href: '/developers' as const },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Vaivém home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher compact />
          <ButtonLink variant="ghost" href="/developers">
            {t('navDevelopers')}
          </ButtonLink>
          <ButtonLink href="/dashboard">{t('ctaDashboard')}</ButtonLink>
        </div>

        <button
          className="inline-flex size-10 items-center justify-center rounded-lg text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div className={cn('border-t border-border bg-background md:hidden', open ? 'block' : 'hidden')}>
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <LanguageSwitcher />
            <ButtonLink variant="outline" href="/developers" onClick={() => setOpen(false)}>
              {t('navDevelopers')}
            </ButtonLink>
            <ButtonLink href="/dashboard" onClick={() => setOpen(false)}>
              {t('ctaDashboard')}
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  )
}
