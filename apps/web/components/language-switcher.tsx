'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const LABELS: Record<AppLocale, string> = {
  en: 'EN',
  es: 'ES',
  'pt-BR': 'PT',
}

export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const t = useTranslations('common')
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-surface p-0.5 dark:border dark:border-border',
        className,
      )}
      role="group"
      aria-label={t('language')}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150',
            locale === loc
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={locale === loc}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  )
}
