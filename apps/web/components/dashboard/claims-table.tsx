'use client'

import { Fragment } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/status-badge'
import { formatDisplay, formatUSDC, relativeTime } from '@/lib/format'
import type { Claim } from '@/lib/types'

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
}

function shortBatch(batchId: string) {
  if (batchId.startsWith('bat_')) return batchId.slice(0, 10)
  return batchId.slice(0, 8)
}

/**
 * Order claims so each batch is contiguous (newest batch first), then
 * unbatched claims by createdAt desc.
 */
export function orderClaimsWithBatches(claims: Claim[]): Claim[] {
  const batches = new Map<string, Claim[]>()
  const singles: Claim[] = []

  for (const c of claims) {
    if (c.batchId) {
      const list = batches.get(c.batchId) ?? []
      list.push(c)
      batches.set(c.batchId, list)
    } else {
      singles.push(c)
    }
  }

  const batchNewest = [...batches.entries()].sort((a, b) => {
    const ta = Math.max(...a[1].map((c) => new Date(c.createdAt).getTime()))
    const tb = Math.max(...b[1].map((c) => new Date(c.createdAt).getTime()))
    return tb - ta
  })

  const out: Claim[] = []
  for (const [, list] of batchNewest) {
    out.push(
      ...list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    )
  }
  out.push(
    ...singles.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  )
  return out
}

function ClaimAmount({ claim, locale }: { claim: Claim; locale: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-sm font-medium tabular-nums">
        {formatDisplay(claim.displayAmount, claim.displayCurrency, locale)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatUSDC(claim.amount, locale)}
      </span>
    </div>
  )
}

function ClaimRecipient({ claim }: { claim: Claim }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-accent text-accent-foreground text-xs">
          {initials(claim.recipientName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{claim.recipientName}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {claim.token}
        </span>
      </div>
    </div>
  )
}

export function ClaimsTable({ claims }: { claims: Claim[] }) {
  const t = useTranslations('dashboard')
  const tTime = useTranslations('time')
  const locale = useLocale()
  const router = useRouter()
  const ordered = orderClaimsWithBatches(claims)

  let lastBatchMobile: string | null | undefined = undefined
  let lastBatchDesktop: string | null | undefined = undefined

  return (
    <>
      {/* Mobile: card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {ordered.map((claim) => {
          const showBatchHeader =
            Boolean(claim.batchId) && claim.batchId !== lastBatchMobile
          lastBatchMobile = claim.batchId ?? null
          const batchPeers = claim.batchId
            ? ordered.filter((c) => c.batchId === claim.batchId)
            : []
          const batchTotal = batchPeers.reduce((s, c) => s + c.amount, 0)

          return (
            <Fragment key={claim.id}>
              {showBatchHeader && claim.batchId ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-xs font-medium">
                    {t('batchHeader', { count: batchPeers.length })} ·{' '}
                    <span className="font-mono text-muted-foreground">
                      {claim.batchId}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatUSDC(batchTotal, locale)}
                  </span>
                </div>
              ) : null}
              <Link
                href={`/dashboard/claims/${claim.token}`}
                className="block rounded-xl border border-border bg-card p-4 transition-colors active:bg-secondary/40"
                aria-label={t('viewClaim', { token: claim.token })}
              >
                <div className="flex items-start justify-between gap-3">
                  <ClaimRecipient claim={claim} />
                  <ClaimAmount claim={claim} locale={locale} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={claim.status} />
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(claim.createdAt, tTime)}
                  </span>
                  {claim.batchId ? (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {t('batchTag', { id: shortBatch(claim.batchId) })}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{claim.purpose}</p>
              </Link>
            </Fragment>
          )
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('columns.recipient')}</TableHead>
              <TableHead>{t('columns.purpose')}</TableHead>
              <TableHead className="text-right">{t('columns.amount')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.created')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((claim) => {
              const showBatchHeader =
                Boolean(claim.batchId) && claim.batchId !== lastBatchDesktop
              lastBatchDesktop = claim.batchId ?? null
              const batchPeers = claim.batchId
                ? ordered.filter((c) => c.batchId === claim.batchId)
                : []
              const batchTotal = batchPeers.reduce((s, c) => s + c.amount, 0)

              return (
                <Fragment key={claim.id}>
                  {showBatchHeader && claim.batchId ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="bg-secondary/50 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {t('batchHeader', { count: batchPeers.length })} ·{' '}
                            <span className="font-mono text-muted-foreground">
                              {claim.batchId}
                            </span>
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatUSDC(batchTotal, locale)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow
                    className="group cursor-pointer"
                    onClick={() => {
                      router.push(`/dashboard/claims/${claim.token}`)
                    }}
                  >
                    <TableCell>
                      <ClaimRecipient claim={claim} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <span>{claim.purpose}</span>
                        {claim.batchId ? (
                          <span className="w-fit rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {t('batchTag', { id: shortBatch(claim.batchId) })}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ClaimAmount claim={claim} locale={locale} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeTime(claim.createdAt, tTime)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/claims/${claim.token}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex text-muted-foreground transition-colors group-hover:text-foreground"
                        aria-label={t('viewClaim', { token: claim.token })}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
