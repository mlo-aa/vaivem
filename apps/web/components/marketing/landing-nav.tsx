'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const LABELS: Record<AppLocale, string> = { en: 'EN', es: 'ES', 'pt-BR': 'PT' }

export function LandingNav() {
  const t = useTranslations('landing')
  const tc = useTranslations('common')
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()

  const links = [
    { label: t('navProblem'), href: '#problem' },
    { label: t('navHow'), href: '#how-it-works' },
    { label: t('navProof'), href: '#proof' },
  ]

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--lp-line)] bg-[var(--lp-bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="Vaivém" className="text-[17px] font-medium tracking-[-0.02em]">
          Vaivém
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="lp-label transition-colors hover:text-[var(--lp-text)]">
              / {l.label}
            </a>
          ))}
          <Link href="/developers" className="lp-label transition-colors hover:text-[var(--lp-text)]">
            / {t('navDevelopers')}
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <div role="group" aria-label={tc('language')} className="flex gap-0.5">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                type="button"
                aria-pressed={locale === loc}
                onClick={() => router.replace(pathname, { locale: loc })}
                className={cn(
                  'lp-label px-1.5 py-1 transition-colors',
                  locale === loc ? 'text-[var(--lp-lime)]' : 'hover:text-[var(--lp-text)]',
                )}
              >
                {LABELS[loc]}
              </button>
            ))}
          </div>
          <Link
            href="/dashboard"
            className="border border-[var(--lp-line-strong)] px-3.5 py-1.5 text-[13px] transition-colors hover:bg-white/5"
          >
            {t('ctaDashboard')}
          </Link>
        </div>
      </div>
    </header>
  )
}
