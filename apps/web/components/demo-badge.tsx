import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Persistent honesty badge. Rendered on any screen still backed by mock data.
 * It must not be hidden — it signals that the numbers are demo values, not
 * live API responses.
 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-warning/40 bg-warning/10 text-warning-foreground',
        className,
      )}
    >
      <FlaskConical className="size-3" />
      Demo data
    </Badge>
  )
}
