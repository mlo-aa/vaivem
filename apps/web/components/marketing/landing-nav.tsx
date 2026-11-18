'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const LABELS: Record<AppLocale, string> = { en: 'EN', es: 'ES', 'pt-BR': 'PT' }

/** Fixed bar that inverts against whatever act is behind it. */
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
    <header className="fixed inset-x-0 top-0 z-50 text-white mix-blend-difference">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Vaivém" className="lp-pixel text-xl sm:text-2xl">
          VAIVÉM<span className="lp-caret">_</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="underline-offset-4 hover:underline">
              /{l.label}
            </a>
          ))}
          <Link href="/developers" className="underline-offset-4 hover:underline">
            /{t('navDevelopers')}
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-xs sm:gap-4 sm:text-sm">
          <div role="group" aria-label={tc('language')} className="flex gap-1">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                type="button"
                aria-pressed={locale === loc}
                onClick={() => router.replace(pathname, { locale: loc })}
                className={cn('px-1.5 py-0.5', locale === loc ? 'underline underline-offset-4' : 'opacity-60 hover:opacity-100')}
              >
                {LABELS[loc]}
              </button>
            ))}
          </div>
          <Link href="/dashboard" className="border-2 border-current px-3 py-1.5 font-bold hover:bg-white hover:text-black">
            {t('ctaDashboard')}
          </Link>
        </div>
      </div>
    </header>
  )
}
