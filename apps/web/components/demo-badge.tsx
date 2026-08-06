import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Honesty badge for screens where something is actually simulated
 * (mock quote/payout, simulated KYC). Do not mount on live dashboard hops.
 */
export function DemoBadge({
  className,
  label = 'Simulated',
}: {
  className?: string
  label?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-warning/40 bg-warning/10 text-warning-foreground',
        className,
      )}
    >
      <FlaskConical className="size-3" />
      {label}
    </Badge>
  )
}
