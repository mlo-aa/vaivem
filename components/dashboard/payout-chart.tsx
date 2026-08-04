'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { payoutActivity } from '@/lib/mock-data'

const chartConfig = {
  sent: { label: 'Sent (USDC)', color: 'var(--chart-2)' },
  claimed: { label: 'Claimed (USDC)', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function PayoutChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout activity</CardTitle>
        <CardDescription>USDC sent vs. claimed over the last 14 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={payoutActivity} margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-sent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillClaimed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-claimed)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-claimed)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="sent"
              type="monotone"
              fill="url(#fillSent)"
              stroke="var(--color-sent)"
              strokeWidth={2}
            />
            <Area
              dataKey="claimed"
              type="monotone"
              fill="url(#fillClaimed)"
              stroke="var(--color-claimed)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
