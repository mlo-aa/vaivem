import {
  Ban,
  CheckCircle2,
  Eye,
  HandCoins,
  Link2,
  Lock,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { relativeTime } from '@/lib/format'
import type { Claim, ClaimEventType } from '@/lib/types'
import { cn } from '@/lib/utils'

const EVENT_META: Record<ClaimEventType, { label: string; icon: LucideIcon }> = {
  created: { label: 'Claim created', icon: Sparkles },
  funds_locked: { label: 'Funds locked on Stellar', icon: Lock },
  shared: { label: 'Link shared with recipient', icon: Link2 },
  opened: { label: 'Recipient opened the link', icon: Eye },
  verified: { label: 'Recipient verified identity', icon: ShieldCheck },
  claimed: { label: 'Funds claimed', icon: HandCoins },
  pix_initiated: { label: 'PIX withdrawal initiated', icon: Send },
  pix_completed: { label: 'PIX withdrawal completed', icon: CheckCircle2 },
  wallet_created: { label: 'Sponsored wallet created', icon: ShieldCheck },
  cancelled: { label: 'Claim cancelled', icon: Ban },
  refunded: { label: 'Funds refunded to sender', icon: RotateCcw },
  expired: { label: 'Claim expired', icon: Ban },
}

// Derive a plausible event history from the claim's current status.
function deriveEvents(claim: Claim): { event: ClaimEventType; timestamp: string }[] {
  const created = claim.createdAt
  const list: { event: ClaimEventType; timestamp: string }[] = [
    { event: 'created', timestamp: created },
    { event: 'funds_locked', timestamp: created },
  ]
  const order: ClaimStatusStep[] = ['shared', 'viewed', 'claimed', 'cashing_out', 'completed']
  const reached = (s: ClaimStatusStep) => order.indexOf(s) <= order.indexOf(claim.status as ClaimStatusStep)

  if (['shared', 'viewed', 'claimed', 'cashing_out', 'completed'].includes(claim.status)) {
    list.push({ event: 'shared', timestamp: created })
  }
  if (['viewed', 'claimed', 'cashing_out', 'completed'].includes(claim.status)) {
    list.push({ event: 'opened', timestamp: created })
    if (claim.protectionType !== 'public') {
      list.push({ event: 'verified', timestamp: created })
    }
  }
  if (['claimed', 'cashing_out', 'completed'].includes(claim.status) && claim.claimedAt) {
    list.push({ event: 'claimed', timestamp: claim.claimedAt })
  }
  if (claim.payoutMethod === 'pix' && ['cashing_out', 'completed'].includes(claim.status)) {
    list.push({ event: 'pix_initiated', timestamp: claim.claimedAt ?? created })
    if (claim.status === 'completed') {
      list.push({ event: 'pix_completed', timestamp: claim.claimedAt ?? created })
    }
  }
  if (claim.payoutMethod === 'stellar' && claim.status === 'claimed') {
    list.push({ event: 'wallet_created', timestamp: claim.claimedAt ?? created })
  }
  if (claim.status === 'refunded') list.push({ event: 'refunded', timestamp: claim.expiresAt })
  if (claim.status === 'expired') list.push({ event: 'expired', timestamp: claim.expiresAt })
  if (claim.status === 'cancelled') list.push({ event: 'cancelled', timestamp: claim.createdAt })
  void reached
  return list
}

type ClaimStatusStep = 'shared' | 'viewed' | 'claimed' | 'cashing_out' | 'completed'

export function ClaimTimeline({ claim }: { claim: Claim }) {
  const events = deriveEvents(claim)
  return (
    <ol className="flex flex-col">
      {events.map((ev, i) => {
        const meta = EVENT_META[ev.event]
        const last = i === events.length - 1
        return (
          <li key={`${ev.event}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  last ? 'bg-brand/15 text-[color-mix(in_oklab,var(--brand),black_40%)]' : 'bg-secondary text-muted-foreground',
                )}
              >
                <meta.icon className="size-4" />
              </span>
              {!last && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className={cn('flex flex-col pb-5', last && 'pb-0')}>
              <span className="text-sm font-medium">{meta.label}</span>
              <span className="text-xs text-muted-foreground">{relativeTime(ev.timestamp)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
