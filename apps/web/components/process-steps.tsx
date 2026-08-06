import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function ProcessSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((label, i) => {
        const step = i + 1
        const done = current > step
        const active = current === step
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  done && 'bg-primary text-primary-foreground',
                  active && 'bg-primary text-primary-foreground',
                  !done && !active && 'bg-surface text-muted-foreground',
                )}
              >
                {done ? (
                  <Check className="size-4" />
                ) : active ? (
                  <Spinner className="size-4" />
                ) : (
                  step
                )}
              </span>
              <span
                className={cn(
                  'text-sm transition-colors duration-150',
                  done || active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
