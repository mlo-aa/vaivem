'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatUSDC } from '@/lib/format'
import { CUSTODY_LINE } from '@/lib/use-sender-balance'

type LedgerEntry = {
  id: string
  type: 'deposit' | 'claim_funded' | 'refund'
  amount: number
  ref: string
  createdAt: string
}

type DepositInstructions = {
  depositClabe: string
  depositAmount: string
  depositBankName: string
  depositAccountHolder: string
}

type PendingOrder = {
  orderId: string
  status: string
  currency: string
  fiatAmount: number
  usdcAmount: number
  createdAt: string
  credited: boolean
}

export default function FundingPage() {
  const router = useRouter()
  const redirected = useRef(false)
  const [amount, setAmount] = useState('100')
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<DepositInstructions | null>(null)
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [quotedUsdc, setQuotedUsdc] = useState<number | null>(null)

  const refreshBalance = useCallback(async () => {
    const res = await fetch('/api/funding/balance')
    if (!res.ok) return 0
    const data = await res.json()
    const next = Number(data.amount ?? 0)
    setBalance(next)
    setLedger(Array.isArray(data.ledger) ? data.ledger : [])
    setPendingOrders(Array.isArray(data.pending) ? data.pending : [])
    return next
  }, [])

  useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  useEffect(() => {
    if (!orderId || orderStatus === 'failed') return
    if (orderStatus === 'completed') {
      if (!redirected.current) {
        redirected.current = true
        router.push('/dashboard/create')
      }
      return
    }
    let cancelled = false
    const tick = async () => {
      const res = await fetch(`/api/funding/${encodeURIComponent(orderId)}`)
      if (!res.ok || cancelled) return
      const data = await res.json()
      const status = String(data.status ?? '')
      setOrderStatus(status)
      if (data.credited || status === 'completed') {
        await refreshBalance()
        if (!cancelled && !redirected.current) {
          redirected.current = true
          router.push('/dashboard/create')
        }
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [orderId, orderStatus, refreshBalance, router])

  async function onDeposit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setInstructions(null)
    setOrderId(null)
    setOrderStatus(null)
    redirected.current = false
    try {
      const res = await fetch('/api/funding/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), currency: 'MXN' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Deposit failed')
        return
      }
      setOrderId(String(data.orderId))
      setOrderStatus('created')
      setQuotedUsdc(Number(data.usdcAmount))
      setInstructions(data.instructions)
      await refreshBalance()
    } catch {
      setError('Could not reach the funding service.')
    } finally {
      setPending(false)
    }
  }

  async function checkStatus(id: string) {
    setCheckingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/funding/${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not check order status')
        return
      }
      const next = await refreshBalance()
      if (data.credited || data.status === 'completed') {
        setOrderStatus('completed')
        if (!redirected.current && next > 0) {
          redirected.current = true
          router.push('/dashboard/create')
        }
      }
    } catch {
      setError('Could not reach the funding service.')
    } finally {
      setCheckingId(null)
    }
  }

  return (
    <>
      <DashboardTopbar title="Funding" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{CUSTODY_LINE}</p>

        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
          <p className="font-medium">Sandbox funding</p>
          <p className="mt-1 text-muted-foreground">
            Only <strong className="text-foreground">MXN</strong> on-ramp works here, up to{' '}
            <strong className="text-foreground">500 MXN</strong> per order. BRL on-ramp is not
            yet available in the Etherfuse sandbox — do not try BRL deposits.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Demo balance</CardTitle>
              <p className="text-sm text-muted-foreground">{CUSTODY_LINE}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold tabular-nums">
                {balance == null ? '—' : formatUSDC(balance)}
              </p>
              {(balance ?? 0) > 0 ? (
                <ButtonLink href="/dashboard/create">Create a claim</ButtonLink>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deposit MXN → USDC</CardTitle>
              <p className="text-sm text-muted-foreground">
                Creates a live Etherfuse on-ramp order. After it completes, you go straight to
                Create.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={onDeposit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mxn" className="text-sm font-medium">
                    Amount (MXN)
                  </label>
                  <Input
                    id="mxn"
                    type="number"
                    min={1}
                    max={500}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">1–500 MXN · currency fixed to MXN</p>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={pending}>
                  {pending ? 'Creating order…' : 'Create MXN deposit'}
                </Button>
              </form>

              {instructions ? (
                <div className="mt-4 space-y-2 rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">Deposit instructions</p>
                  <p>
                    Bank: <span className="font-mono">{instructions.depositBankName}</span>
                  </p>
                  <p>
                    CLABE:{' '}
                    <span className="font-mono">{instructions.depositClabe || '—'}</span>
                  </p>
                  <p>
                    Amount:{' '}
                    <span className="font-mono">
                      {instructions.depositAmount} MXN
                    </span>
                  </p>
                  <p>Holder: {instructions.depositAccountHolder}</p>
                  {quotedUsdc != null ? (
                    <p>Credits ≈ {formatUSDC(quotedUsdc)} when the order completes</p>
                  ) : null}
                  {orderId ? (
                    <p className="text-muted-foreground">
                      Order <span className="font-mono">{orderId}</span> — status:{' '}
                      {orderStatus ?? '…'}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Sandbox: simulate fiat with Etherfuse{"'"}s fiat_received endpoint. You can
                    leave this page — the deposit stays pending until you return or tap Check
                    status.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {pendingOrders.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending deposits</CardTitle>
              <p className="text-sm text-muted-foreground">
                Orders waiting on Etherfuse. Status is refreshed on every page load; use Check
                status after simulating fiat in the sandbox.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Fiat</TableHead>
                    <TableHead>USDC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((row) => (
                    <TableRow key={row.orderId}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                        {row.orderId}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.fiatAmount} {row.currency}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatUSDC(row.usdcAmount)}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={checkingId === row.orderId}
                          onClick={() => void checkStatus(row.orderId)}
                        >
                          {checkingId === row.orderId ? 'Checking…' : 'Check status'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="tabular-nums">{formatUSDC(row.amount)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.ref}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
