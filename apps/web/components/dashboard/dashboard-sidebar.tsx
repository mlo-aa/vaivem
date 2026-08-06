'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { Link2, Plus, Code2, LifeBuoy, Wallet, Upload } from 'lucide-react'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { useSenderBalance } from '@/lib/use-sender-balance'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const NAV = [
  { labelKey: 'claims' as const, href: '/dashboard', icon: Link2, needsFunds: false },
  { labelKey: 'createClaim' as const, href: '/dashboard/create', icon: Plus, needsFunds: true },
  {
    labelKey: 'batchCsv' as const,
    href: '/dashboard/create/batch',
    icon: Upload,
    needsFunds: true,
  },
  { labelKey: 'funding' as const, href: '/dashboard/funding', icon: Wallet, needsFunds: false },
  { labelKey: 'developers' as const, href: '/developers', icon: Code2, needsFunds: false },
]

export function DashboardSidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { funded, loading } = useSenderBalance()
  const createLocked = !loading && !funded

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-transparent bg-background lg:flex dark:border-border">
      <div className="flex h-[4.5rem] items-center px-6">
        <Link href="/dashboard" aria-label="Vaivém dashboard">
          <Logo />
        </Link>
      </div>
      <TooltipProvider>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="Dashboard">
          {NAV.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : item.href === '/dashboard/create'
                  ? pathname === '/dashboard/create'
                  : pathname.startsWith(item.href)
            const locked = item.needsFunds && createLocked
            const className = cn(
              'flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-150',
              locked
                ? 'cursor-not-allowed text-muted-foreground/50'
                : active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
            )
            if (locked) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    className={className}
                    render={<button type="button" />}
                  >
                    <item.icon className="size-4.5 shrink-0" />
                    {t(item.labelKey)}
                  </TooltipTrigger>
                  <TooltipContent side="right">{t('addFundsFirst')}</TooltipContent>
                </Tooltip>
              )
            }
            return (
              <Link key={item.href} href={item.href} className={className}>
                <item.icon className="size-4.5 shrink-0" />
                {t(item.labelKey)}
              </Link>
            )
          })}
        </nav>
      </TooltipProvider>
      <div className="border-t border-transparent p-3 dark:border-border">
        <a
          href="mailto:support@vaivem.app"
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-foreground"
        >
          <LifeBuoy className="size-4.5 shrink-0" />
          {t('support')}
        </a>
      </div>
    </aside>
  )
}
