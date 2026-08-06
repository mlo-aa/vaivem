'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search, Wallet } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
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
import { formatUSDC, isActiveStatus } from '@/lib/format'
import { useSenderBalance } from '@/lib/use-sender-balance'
import type { Claim } from '@/lib/types'

type Filter = 'all' | 'active' | 'completed' | 'refunded'

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tCustody = useTranslations('custody')
  const locale = useLocale()
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

  const activeCount = claims.filter((c) => isActiveStatus(c.status)).length

  return (
    <>
      <DashboardTopbar title={t('title')} />
      <main className="flex-1 space-y-6 px-4 pb-10 sm:px-8 lg:px-8">
        {/* Bento: hero balance + compact stats */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Link
            href="/dashboard/funding"
            className="rounded-[1.25rem] bg-primary p-6 text-primary-foreground transition-opacity duration-150 hover:opacity-95 sm:p-7"
          >
            <p className="text-sm font-medium text-primary-foreground/70">
              {tCustody('line')}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.02em] tabular-nums sm:text-5xl">
              {balance == null ? '—' : formatUSDC(balance, locale)}
            </p>
          </Link>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[1.25rem] bg-surface p-6 dark:border dark:border-border">
              <p className="text-sm text-muted-foreground">{t('filterAll')}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] tabular-nums">
                {claims.length}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-surface p-6 dark:border dark:border-border">
              <p className="text-sm text-muted-foreground">{t('filterActive')}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.02em] tabular-nums">
                {activeCount}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="rounded-full border-transparent bg-surface sm:max-w-xs dark:border dark:border-border">
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent"
            />
          </InputGroup>
          <ToggleGroup
            value={[filter]}
            onValueChange={(v) => {
              if (v[0]) setFilter(v[0] as Filter)
            }}
            className="w-fit gap-1 rounded-full bg-surface p-1 dark:border dark:border-border"
          >
            <ToggleGroupItem
              value="all"
              className="rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground dark:data-[state=on]:bg-foreground dark:data-[state=on]:text-background"
            >
              {t('filterAll')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="active"
              className="rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground dark:data-[state=on]:bg-foreground dark:data-[state=on]:text-background"
            >
              {t('filterActive')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="completed"
              className="rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground dark:data-[state=on]:bg-foreground dark:data-[state=on]:text-background"
            >
              {t('filterCompleted')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="refunded"
              className="rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground dark:data-[state=on]:bg-foreground dark:data-[state=on]:text-background"
            >
              {t('filterClosed')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {bootstrapping ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-[1.25rem]" />
            <Skeleton className="h-24 w-full rounded-[1.25rem]" />
            <Skeleton className="h-24 w-full rounded-[1.25rem]" />
          </div>
        ) : filtered.length > 0 ? (
          <ClaimsTable claims={filtered} />
        ) : claims.length === 0 ? (
          <Empty className="rounded-[1.25rem] bg-surface p-8 dark:border dark:border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {funded ? <Search /> : <Wallet />}
              </EmptyMedia>
              <EmptyTitle>
                {funded ? t('emptyTitle') : t('emptyUnfunded')}
              </EmptyTitle>
              <EmptyDescription>
                {funded ? t('emptyFunded') : t('emptyUnfundedBody')}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <ButtonLink href={funded ? '/dashboard/create' : '/dashboard/funding'}>
                {funded ? t('createClaim') : t('goFunding')}
              </ButtonLink>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="rounded-[1.25rem] bg-surface p-8 dark:border dark:border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>{t('noResultsTitle')}</EmptyTitle>
              <EmptyDescription>{t('noResultsBody')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </main>
    </>
  )
}
