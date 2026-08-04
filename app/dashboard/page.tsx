import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock, Link2, Wallet } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { StatCards, type Stat } from '@/components/dashboard/stat-cards'
import { PayoutChart } from '@/components/dashboard/payout-chart'
import { ClaimsTable } from '@/components/dashboard/claims-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { claims } from '@/lib/mock-data'
import { formatUSDC, isActiveStatus } from '@/lib/format'

const totalSent = claims.reduce((sum, c) => sum + c.amount, 0)
const claimed = claims.filter((c) => ['claimed', 'cashing_out', 'completed'].includes(c.status))
const active = claims.filter((c) => isActiveStatus(c.status))
const completed = claims.filter((c) => c.status === 'completed')
const claimRate = Math.round((claimed.length / claims.length) * 100)

const stats: Stat[] = [
  {
    label: 'Total sent',
    value: formatUSDC(totalSent),
    sublabel: `Across ${claims.length} claims`,
    delta: { value: '18.2%', positive: true },
    icon: Wallet,
  },
  {
    label: 'Active claims',
    value: String(active.length),
    sublabel: 'Awaiting recipient action',
    icon: Link2,
  },
  {
    label: 'Claim rate',
    value: `${claimRate}%`,
    sublabel: 'Links opened and claimed',
    delta: { value: '4.1%', positive: true },
    icon: CheckCircle2,
  },
  {
    label: 'Avg. time to claim',
    value: '3h 12m',
    sublabel: 'From share to cash-out',
    delta: { value: '11m', positive: true },
    icon: Clock,
  },
]

export default function DashboardPage() {
  const recent = [...claims].slice(0, 5)
  return (
    <>
      <DashboardTopbar title="Overview" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <StatCards stats={stats} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PayoutChart />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>This month</CardTitle>
              <CardDescription>Payout summary for your organization</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SummaryRow label="Completed payouts" value={String(completed.length)} />
              <SummaryRow label="Funds locked on Stellar" value={formatUSDC(totalSent)} />
              <SummaryRow
                label="Refunded / expired"
                value={String(
                  claims.filter((c) => ['refunded', 'expired'].includes(c.status)).length,
                )}
              />
              <SummaryRow label="Recipients reached" value={String(claims.length)} />
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Recent claims</h2>
            <Link
              href="/dashboard/claims"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <ClaimsTable claims={recent} />
        </section>
      </main>
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}
