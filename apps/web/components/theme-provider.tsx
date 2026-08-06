'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

function isClaimPath(pathname: string | null): boolean {
  if (!pathname) return false
  // /claim/... or /{locale}/claim/...
  return (
    pathname === '/claim' ||
    pathname.startsWith('/claim/') ||
    /\/claim(\/|$)/.test(pathname)
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const claimOnly = isClaimPath(pathname)

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={claimOnly ? 'light' : undefined}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
