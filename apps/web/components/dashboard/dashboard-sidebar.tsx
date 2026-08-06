'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Link2, Plus, Code2, LifeBuoy, Wallet } from 'lucide-react'
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
  { label: 'Claims', href: '/dashboard', icon: Link2, needsFunds: false },
  { label: 'Create claim', href: '/dashboard/create', icon: Plus, needsFunds: true },
  { label: 'Funding', href: '/dashboard/funding', icon: Wallet, needsFunds: false },
  { label: 'Developers', href: '/developers', icon: Code2, needsFunds: false },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { funded, loading } = useSenderBalance()
  const createLocked = !loading && !funded

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" aria-label="Vaivém dashboard">
          <Logo />
        </Link>
      </div>
      <TooltipProvider>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Dashboard">
          {NAV.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            const locked = item.needsFunds && createLocked
            const className = cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
              locked
                ? 'cursor-not-allowed text-muted-foreground/50'
                : active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )
            if (locked) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    className={className}
                    render={<button type="button" />}
                  >
                    <item.icon className="size-4.5 shrink-0" />
                    {item.label}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Add funds on the Funding page before creating a claim.
                  </TooltipContent>
                </Tooltip>
              )
            }
            return (
              <Link key={item.href} href={item.href} className={className}>
                <item.icon className="size-4.5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </TooltipProvider>
      <div className="border-t border-border p-3">
        <a
          href="mailto:support@vaivem.app"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LifeBuoy className="size-4.5 shrink-0" />
          Support
        </a>
      </div>
    </aside>
  )
}
