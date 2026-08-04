'use client'

import Link from 'next/link'
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

export function ClaimsTable({ claims }: { claims: Claim[] }) {
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
          {claims.map((claim) => (
            <TableRow
              key={claim.id}
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
                    <span className="text-sm font-medium">{claim.recipientName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{claim.token}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{claim.purpose}</TableCell>
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
