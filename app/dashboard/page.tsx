'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { ClaimsTable } from '@/components/dashboard/claims-table'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { claims } from '@/lib/mock-data'
import { isActiveStatus } from '@/lib/format'

type Filter = 'all' | 'active' | 'completed' | 'refunded'

export default function DashboardPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

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
  }, [query, filter])

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
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            className="w-fit"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="active">Active</ToggleGroupItem>
            <ToggleGroupItem value="completed">Completed</ToggleGroupItem>
            <ToggleGroupItem value="refunded">Closed</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {filtered.length > 0 ? (
          <ClaimsTable claims={filtered} />
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
