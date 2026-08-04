'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Link2, Plus, Code2, LifeBuoy } from 'lucide-react'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Claims', href: '/dashboard', icon: Link2 },
  { label: 'Create claim', href: '/dashboard/create', icon: Plus },
  { label: 'Developers', href: '/developers', icon: Code2 },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" aria-label="Vaivém dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Dashboard">
        {NAV.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
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
