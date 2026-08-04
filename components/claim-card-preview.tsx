import { ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// A static, presentational preview of the recipient claim card — used on the
// landing page and marketing surfaces.
export function ClaimCardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl shadow-navy/5',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-navy text-navy-foreground">
            <Sparkles className="size-4 text-brand" />
          </span>
          <span className="text-sm font-medium">ClaimLink</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-[color-mix(in_oklab,var(--brand),black_40%)]">
          <ShieldCheck className="size-3.5" />
          Secure claim
        </span>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">You received</p>
        <p className="mt-1 font-mono text-4xl font-semibold tracking-tight">R$500,00</p>
        <p className="mt-1 text-sm text-muted-foreground">Approximately 99.10 USDC</p>
      </div>

      <div className="mt-6 rounded-2xl bg-secondary p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">From</span>
          <span className="font-medium">Brazil Builders Hackathon</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Network</span>
          <span className="font-medium">Stellar · USDC</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-brand py-3 text-center text-sm font-semibold text-brand-foreground">
        Claim funds
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        No wallet needed · Keep as USDC or cash out via PIX
      </p>
    </div>
  )
}
