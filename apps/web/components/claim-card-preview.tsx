import { ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// A static, presentational preview of the recipient claim card — used on the
// landing page and marketing surfaces.
export function ClaimCardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-[1.5rem] bg-card p-6 dark:border dark:border-border',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
            <Sparkles className="size-4 text-primary" />
          </span>
          <span className="text-sm font-medium">Vaivém</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-foreground dark:border dark:border-border">
          <ShieldCheck className="size-3.5" />
          Secure claim
        </span>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">You received</p>
        <p className="mt-1 text-4xl font-semibold tracking-[-0.02em] tabular-nums">
          R$500,00
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Approximately 99.10 USDC</p>
      </div>

      <div className="mt-6 rounded-[1.25rem] bg-background p-4 dark:border dark:border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">From</span>
          <span className="font-medium">Acme Payments</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Network</span>
          <span className="font-medium">Stellar · USDC</span>
        </div>
      </div>

      <div className="mt-4 rounded-full bg-primary py-3 text-center text-sm font-semibold text-primary-foreground">
        Claim funds
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        No wallet needed · Keep as USDC or cash out via PIX
      </p>
    </div>
  )
}
