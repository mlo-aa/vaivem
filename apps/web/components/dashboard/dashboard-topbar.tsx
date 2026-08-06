'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, Plus, Wallet as WalletIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Logo } from '@/components/logo'
import { formatUSDC } from '@/lib/format'
import { CUSTODY_LINE, useSenderBalance } from '@/lib/use-sender-balance'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const MOBILE_NAV = [
  { label: 'Claims', href: '/dashboard', needsFunds: false },
  { label: 'Create claim', href: '/dashboard/create', needsFunds: true },
  { label: 'Funding', href: '/dashboard/funding', needsFunds: false },
  { label: 'Developers', href: '/developers', needsFunds: false },
]

function initials(name: string) {
  return name
    .split(/[\s@]+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function DashboardTopbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('Sender')
  const [displayEmail, setDisplayEmail] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const { balance, funded, loading: balanceLoading } = useSenderBalance()
  const createLocked = !balanceLoading && !funded

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meRes = await fetch('/api/auth/me')
        if (!cancelled && meRes.ok) {
          const data = await meRes.json()
          setDisplayName(String(data.user?.name || data.user?.email || 'Sender'))
          setDisplayEmail(String(data.user?.email || ''))
        }
      } catch {
        // leave defaults
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex size-9 items-center justify-center rounded-lg text-foreground lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="h-16 justify-center px-6">
                <SheetTitle className="flex items-center">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-3" aria-label="Mobile dashboard">
                {MOBILE_NAV.map((item) => {
                  const active =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href)
                  const locked = item.needsFunds && createLocked
                  if (locked) {
                    return (
                      <span
                        key={item.href}
                        title="Add funds on the Funding page before creating a claim."
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
                      >
                        {item.label}
                      </span>
                    )
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'rounded-lg px-3 py-2.5 text-sm font-medium',
                        active
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden flex-col items-end sm:flex">
            <Link
              href="/dashboard/funding"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 hover:bg-secondary/60"
            >
              <WalletIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium tabular-nums">
                {balance == null ? '—' : formatUSDC(balance)}
              </span>
            </Link>
            <p className="mt-0.5 max-w-[220px] text-right text-[10px] leading-tight text-muted-foreground">
              {CUSTODY_LINE}
            </p>
          </div>
          <TooltipProvider>
            {createLocked ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button size="sm" disabled className="pointer-events-auto" />
                  }
                >
                  <Plus data-icon="inline-start" />
                  New claim
                </TooltipTrigger>
                <TooltipContent>
                  Add funds on the Funding page before creating a claim.
                </TooltipContent>
              </Tooltip>
            ) : (
              <ButtonLink href="/dashboard/create" size="sm">
                <Plus data-icon="inline-start" />
                New claim
              </ButtonLink>
            )}
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-navy text-navy-foreground text-xs">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{displayName}</span>
                    {displayEmail ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {displayEmail}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href="/dashboard/funding" />}>
                  Funding
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/developers" />}>
                  Developers
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/" />}>View public site</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void logout()}>Sign out</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
