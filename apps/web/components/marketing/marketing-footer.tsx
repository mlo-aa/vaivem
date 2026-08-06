'use client'

import { useTranslations } from 'next-intl'
import { Logo } from '@/components/logo'
import { Link } from '@/i18n/navigation'

export function MarketingFooter() {
  const t = useTranslations('landing')
  const year = new Date().getFullYear()

  const columns = [
    {
      title: t('footerProduct'),
      links: [
        { label: t('footerHow'), href: '/#how-it-works' as const },
        { label: t('footerProblem'), href: '/#problem' as const },
        { label: t('footerProof'), href: '/#proof' as const },
        { label: t('footerDashboard'), href: '/dashboard' as const },
      ],
    },
    {
      title: t('footerDevelopers'),
      links: [
        { label: t('footerDocs'), href: '/developers' as const },
        { label: t('footerApi'), href: '/developers' as const },
      ],
    },
    {
      title: t('footerCompany'),
      links: [
        { label: t('footerAbout'), href: '/' as const },
        { label: t('footerPrivacy'), href: '/' as const },
        { label: t('footerTerms'), href: '/' as const },
      ],
    },
  ]

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t('footerBlurb')}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>{t('footerLegal', { year })}</p>
          <p>{t('footerPowered')}</p>
        </div>
      </div>
    </footer>
  )
}
