import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface Stat {
  label: string
  value: string
  sublabel: string
  delta?: { value: string; positive: boolean }
  icon: LucideIcon
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="gap-0">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                <stat.icon className="size-4.5" />
              </span>
              {stat.delta && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-medium',
                    stat.delta.positive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {stat.delta.positive ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  {stat.delta.value}
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/80">{stat.sublabel}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
