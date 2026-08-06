'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Wallet } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { ClaimsTable } from '@/components/dashboard/claims-table'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ButtonLink } from '@/components/ui/button-link'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { listClaims } from '@/lib/services'
import { isActiveStatus } from '@/lib/format'
import { useSenderBalance } from '@/lib/use-sender-balance'
import { useMemo, useState } from 'react'
import type { Claim } from '@/lib/types'

type Filter = 'all' | 'active' | 'completed' | 'refunded'

export default function DashboardPage() {
  const router = useRouter()
  const { balance, loading: balanceLoading, funded } = useSenderBalance()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listClaims()
        if (!cancelled) setClaims(list)
      } catch {
        if (!cancelled) setClaims([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // First-time sender: no funds and no claims → funding, not an empty claims list.
  useEffect(() => {
    if (loading || balanceLoading) return
    if (claims.length === 0 && balance === 0) {
      router.replace('/dashboard/funding')
    }
  }, [loading, balanceLoading, claims.length, balance, router])

  const filtered = useMemo(() => {
    return claims.filter((c) => {
      const matchesQuery =
        query.trim() === '' ||
        c.recipientName.toLowerCase().includes(query.toLowerCase()) ||
        c.token.toLowerCase().includes(query.toLowerCase()) ||
        c.purpose.toLowerCase().includes(query.toLowerCase())
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'active'
            ? isActiveStatus(c.status)
            : filter === 'completed'
              ? c.status === 'completed'
              : ['refunded', 'expired', 'cancelled'].includes(c.status)
      return matchesQuery && matchesFilter
    })
  }, [claims, query, filter])

  const bootstrapping =
    loading || balanceLoading || (claims.length === 0 && balance === 0)

  return (
    <>
      <DashboardTopbar title="Claims" />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="sm:max-w-xs">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search recipient, token, purpose"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <ToggleGroup
            value={[filter]}
            onValueChange={(v) => {
              if (v[0]) setFilter(v[0] as Filter)
            }}
            className="w-fit"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="active">Active</ToggleGroupItem>
            <ToggleGroupItem value="completed">Completed</ToggleGroupItem>
            <ToggleGroupItem value="refunded">Closed</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {bootstrapping ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length > 0 ? (
          <ClaimsTable claims={filtered} />
        ) : claims.length === 0 ? (
          <Empty className="rounded-xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {funded ? <Search /> : <Wallet />}
              </EmptyMedia>
              <EmptyTitle>
                {funded ? 'No claims yet' : 'Add funds to send a claim'}
              </EmptyTitle>
              <EmptyDescription>
                {funded
                  ? 'Create a claim to lock USDC and share a payout link.'
                  : 'Your demo balance is empty. Fund with MXN first, then create a claim.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <ButtonLink href={funded ? '/dashboard/create' : '/dashboard/funding'}>
                {funded ? 'Create claim' : 'Go to funding'}
              </ButtonLink>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="rounded-xl border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No claims found</EmptyTitle>
              <EmptyDescription>
                Try adjusting your search or filters to find what you&apos;re looking for.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </>
  )
}
