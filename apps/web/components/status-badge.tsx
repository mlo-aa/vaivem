'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { STATUS_META } from '@/lib/format'
import type { ClaimStatus } from '@/lib/types'

/** Neutral-only badges — no secondary brand colours. */
const TONE_CLASSES: Record<string, string> = {
  brand: 'bg-foreground text-background',
  success: 'bg-foreground text-background',
  info: 'bg-surface text-foreground ring-1 ring-inset ring-border dark:ring-border',
  warning: 'bg-surface text-foreground ring-1 ring-inset ring-border dark:ring-border',
  muted: 'bg-surface text-muted-foreground ring-1 ring-inset ring-border dark:ring-border',
  destructive: 'bg-surface text-destructive ring-1 ring-inset ring-border dark:ring-border',
}

export function StatusBadge({
  status,
  className,
}: {
  status: ClaimStatus
  className?: string
}) {
  const t = useTranslations('status')
  const meta = STATUS_META[status] ?? { label: status, tone: 'muted' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[meta.tone] ?? TONE_CLASSES.muted,
        className,
      )}
    >
      {t(status)}
    </span>
  )
}
