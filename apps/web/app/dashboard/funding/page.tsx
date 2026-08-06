'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { Button } from '@/components/ui/button'
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

export default function FundingPage() {
  const [amount, setAmount] = useState('100')
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<DepositInstructions | null>(null)
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [quotedUsdc, setQuotedUsdc] = useState<number | null>(null)

  const refreshBalance = useCallback(async () => {
    const res = await fetch('/api/funding/balance')
    if (!res.ok) return
    const data = await res.json()
    setBalance(Number(data.amount ?? 0))
    setLedger(Array.isArray(data.ledger) ? data.ledger : [])
  }, [])

  useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  useEffect(() => {
    if (!orderId || orderStatus === 'completed' || orderStatus === 'failed') return
    let cancelled = false
    const tick = async () => {
      const res = await fetch(`/api/funding/${encodeURIComponent(orderId)}`)
      if (!res.ok || cancelled) return
      const data = await res.json()
      setOrderStatus(String(data.status ?? ''))
      if (data.credited || data.status === 'completed') {
        await refreshBalance()
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [orderId, orderStatus, refreshBalance])

  async function onDeposit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setInstructions(null)
    setOrderId(null)
    setOrderStatus(null)
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
    } catch {
      setError('Could not reach the funding service.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DashboardTopbar title="Funding" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Demo balance</CardTitle>
              <p className="text-sm text-muted-foreground">
                Internal ledger for this sender. On-chain USDC still sits in the shared
                sponsor wallet — this is not custody segregation.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">
                {balance == null ? '—' : formatUSDC(balance)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deposit MXN → USDC</CardTitle>
              <p className="text-sm text-muted-foreground">
                Etherfuse sandbox on-ramp. Max 500 MXN. BRL is not available in sandbox yet.
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
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={pending}>
                  {pending ? 'Creating order…' : 'Create deposit order'}
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
                    Sandbox: simulate fiat with Etherfuse{"'"}s fiat_received endpoint, then
                    wait for status completed.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

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
