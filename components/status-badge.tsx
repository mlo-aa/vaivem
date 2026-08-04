import { cn } from '@/lib/utils'
import { STATUS_META } from '@/lib/format'
import type { ClaimStatus } from '@/lib/types'

const TONE_CLASSES: Record<string, string> = {
  brand: 'bg-brand/15 text-[color-mix(in_oklab,var(--brand),black_38%)] ring-brand/25',
  success: 'bg-success/15 text-[color-mix(in_oklab,var(--success),black_35%)] ring-success/25',
  info: 'bg-info/12 text-info ring-info/25',
  warning: 'bg-warning/20 text-warning-foreground ring-warning/30',
  muted: 'bg-muted text-muted-foreground ring-border',
  destructive: 'bg-destructive/12 text-destructive ring-destructive/25',
}

export function StatusBadge({
  status,
  className,
}: {
  status: ClaimStatus
  className?: string
}) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  )
}
