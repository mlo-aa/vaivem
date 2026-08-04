'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button-link'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Use cases', href: '/#use-cases' },
  { label: 'Developers', href: '/developers' },
  { label: 'Demo claim', href: '/claim/demo-active' },
]

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="ClaimLink home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink variant="ghost" href="/login">
            Log in
          </ButtonLink>
          <ButtonLink href="/signup">Create a ClaimLink</ButtonLink>
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
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <ButtonLink variant="outline" href="/login" onClick={() => setOpen(false)}>
              Log in
            </ButtonLink>
            <ButtonLink href="/signup" onClick={() => setOpen(false)}>
              Create a ClaimLink
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  )
}
