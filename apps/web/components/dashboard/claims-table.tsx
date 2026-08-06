'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
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

export function ClaimsTable({ claims }: { claims: Claim[] }) {
  const ordered = orderClaimsWithBatches(claims)
  let lastBatch: string | null | undefined = undefined

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Recipient</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((claim) => {
            const showBatchHeader =
              Boolean(claim.batchId) && claim.batchId !== lastBatch
            lastBatch = claim.batchId ?? null
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
                          Batch · {batchPeers.length} claims ·{' '}
                          <span className="font-mono text-muted-foreground">
                            {claim.batchId}
                          </span>
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatUSDC(batchTotal)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                <TableRow
                  className="group cursor-pointer"
                  onClick={() => {
                    window.location.href = `/dashboard/claims/${claim.token}`
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                          {initials(claim.recipientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {claim.recipientName}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {claim.token}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      <span>{claim.purpose}</span>
                      {claim.batchId ? (
                        <span className="w-fit rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          batch {shortBatch(claim.batchId)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium tabular-nums">
                        {formatDisplay(claim.displayAmount, claim.displayCurrency)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatUSDC(claim.amount)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={claim.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {relativeTime(claim.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/claims/${claim.token}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex text-muted-foreground transition-colors group-hover:text-foreground"
                      aria-label={`View claim ${claim.token}`}
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
  )
}
