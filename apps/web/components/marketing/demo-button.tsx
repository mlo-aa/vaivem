'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Link, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGIN !== 'off'

/**
 * One-click entry to the public testnet demo: opens the dashboard straight away.
 * Reuses the visitor's session if they already have one, so it doesn't burn the demo quota.
 */
export function DemoButton({
  variant = 'solid',
  className,
}: {
  variant?: 'solid' | 'line' | 'nav'
  className?: string
}) {
  const t = useTranslations('landing')
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const styles = cn(
    'inline-flex items-center justify-center font-medium transition-[background-color,filter] disabled:opacity-70',
    variant === 'nav' ? 'px-3.5 py-1.5 text-[13px]' : 'px-5 py-2.5 text-sm',
    variant === 'line'
      ? 'border border-[var(--lp-line-strong)] hover:bg-white/5'
      : 'bg-[var(--lp-lime)] text-black hover:brightness-95',
    className,
  )

  if (!DEMO_ENABLED) {
    return (
      <Link href="/dashboard" className={styles}>
        {t('ctaCreate')}
      </Link>
    )
  }

  async function start() {
    if (pending) return
    setPending(true)
    try {
      const me = await fetch('/api/auth/me')
      if (!me.ok) {
        const res = await fetch('/api/auth/demo', { method: 'POST' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data.error === 'demo_busy' ? t('demoBusy') : t('demoError'))
          return
        }
      }
      router.push('/dashboard')
    } catch {
      toast.error(t('demoError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <button type="button" onClick={() => void start()} disabled={pending} className={styles}>
      {pending ? t('demoStarting') : t('ctaDemo')}
    </button>
  )
}
