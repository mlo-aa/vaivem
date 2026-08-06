'use client'

import { useTranslations } from 'next-intl'
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

const EVENT_ICONS: Record<ClaimEventType, LucideIcon> = {
  created: Sparkles,
  funds_locked: Lock,
  shared: Link2,
  opened: Eye,
  verified: ShieldCheck,
  claimed: HandCoins,
  pix_initiated: Send,
  pix_completed: CheckCircle2,
  wallet_created: ShieldCheck,
  cancelled: Ban,
  refunded: RotateCcw,
  expired: Ban,
}

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
  const t = useTranslations('dashboard.timeline')
  const tTime = useTranslations('time')
  const events = deriveEvents(claim)
  return (
    <ol className="flex flex-col">
      {events.map((ev, i) => {
        const Icon = EVENT_ICONS[ev.event]
        const last = i === events.length - 1
        return (
          <li key={`${ev.event}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  last ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
              </span>
              {!last && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className={cn('flex flex-col pb-5', last && 'pb-0')}>
              <span className="text-sm font-medium">{t(ev.event)}</span>
              <span className="text-xs text-muted-foreground">{relativeTime(ev.timestamp, tTime)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
