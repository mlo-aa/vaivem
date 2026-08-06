'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
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

const SANDBOX_FIAT_MAX = 500

type FundingMethod = 'fiat' | 'usdc'
type FundingCurrency = 'BRL' | 'MXN'

type LedgerEntry = {
  id: string
  type: 'deposit' | 'deposit_usdc' | 'claim_funded' | 'refund'
  amount: number
  ref: string
  createdAt: string
}

type DepositInstructions = {
  rail: 'spei' | 'pix'
  depositAmount: string
  depositBankName: string
  depositAccountHolder: string
  depositClabe?: string
  statusPage?: string
  pixCopyPaste?: string
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

type UsdcDepositInfo = {
  address: string
  memo: string
  memoType: string
  assetCode: string
  assetIssuer: string
  network: string
  note?: string
}

function hasPixCopyPaste(instructions: DepositInstructions): boolean {
  return Boolean(instructions.pixCopyPaste?.trim())
}

export default function FundingPage() {
  const router = useRouter()
  const redirected = useRef(false)
  const [method, setMethod] = useState<FundingMethod>('fiat')
  const [currency, setCurrency] = useState<FundingCurrency>('BRL')
  const [amount, setAmount] = useState('100')
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [usdcInfo, setUsdcInfo] = useState<UsdcDepositInfo | null>(null)
  const [usdcCredits, setUsdcCredits] = useState<{ txHash: string; amount: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [instructions, setInstructions] = useState<DepositInstructions | null>(null)
  const [depositNote, setDepositNote] = useState<string | null>(null)
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [quotedUsdc, setQuotedUsdc] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const refreshBalance = useCallback(async () => {
    const res = await fetch('/api/funding/balance')
    if (!res.ok) return 0
    const data = await res.json()
    const next = Number(data.amount ?? 0)
    setBalance(next)
    setLedger(Array.isArray(data.ledger) ? data.ledger : [])
    setPendingOrders(Array.isArray(data.pending) ? data.pending : [])
    if (Array.isArray(data.usdcCredits) && data.usdcCredits.length > 0) {
      setUsdcCredits(data.usdcCredits)
    }
    return next
  }, [])

  const loadUsdcInfo = useCallback(async () => {
    const res = await fetch('/api/funding/usdc')
    if (!res.ok) return
    const data = await res.json()
    setUsdcInfo({
      address: String(data.address ?? ''),
      memo: String(data.memo ?? ''),
      memoType: String(data.memoType ?? 'hash'),
      assetCode: String(data.assetCode ?? 'USDC'),
      assetIssuer: String(data.assetIssuer ?? ''),
      network: String(data.network ?? 'testnet'),
      note: typeof data.note === 'string' ? data.note : undefined,
    })
  }, [])

  useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  useEffect(() => {
    if (method === 'usdc') void loadUsdcInfo()
  }, [method, loadUsdcInfo])

  useEffect(() => {
    if (method !== 'usdc') return
    const id = setInterval(() => void refreshBalance(), 8000)
    return () => clearInterval(id)
  }, [method, refreshBalance])

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
    setDepositNote(null)
    setOrderId(null)
    setOrderStatus(null)
    setCopied(null)
    redirected.current = false
    try {
      const res = await fetch('/api/funding/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), currency }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Deposit failed')
        return
      }
      setOrderId(String(data.orderId))
      setOrderStatus('created')
      setQuotedUsdc(Number(data.usdcAmount))
      setInstructions(data.instructions ?? null)
      setDepositNote(typeof data.note === 'string' ? data.note : null)
      await refreshBalance()
    } catch {
      setError('Could not reach the funding service.')
    } finally {
      setPending(false)
    }
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Could not copy to clipboard.')
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

  const showPixCopyPaste = instructions ? hasPixCopyPaste(instructions) : false

  return (
    <>
      <DashboardTopbar title="Funding" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{CUSTODY_LINE}</p>

        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
          <p className="font-medium">Sandbox funding</p>
          <p className="mt-1 text-muted-foreground">
            Two ways to fund: fiat on-ramp (
            <strong className="text-foreground">BRL</strong> /{' '}
            <strong className="text-foreground">MXN</strong>, max {SANDBOX_FIAT_MAX}) or send{' '}
            <strong className="text-foreground">Etherfuse USDC</strong> on Stellar testnet with
            your memo. Credits reconcile on every page load.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={method === 'fiat' ? 'default' : 'outline'}
            onClick={() => setMethod('fiat')}
          >
            Fiat on-ramp
          </Button>
          <Button
            type="button"
            size="sm"
            variant={method === 'usdc' ? 'default' : 'outline'}
            onClick={() => setMethod('usdc')}
          >
            USDC deposit
          </Button>
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
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="/dashboard/create">Create a claim</ButtonLink>
                  <ButtonLink href="/dashboard/create/batch" variant="outline">
                    Batch from CSV
                  </ButtonLink>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {method === 'usdc' ? (
            <Card>
              <CardHeader>
                <CardTitle>Deposit USDC (Stellar)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  For DAOs and treasuries that already hold USDC. Send to the sponsor address
                  with your unique memo — credits appear after Horizon sees the payment.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!usdcInfo ? (
                  <p className="text-muted-foreground">Loading deposit details…</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Required asset</p>
                      <p className="font-mono text-xs break-all">
                        {usdcInfo.assetCode}:
                        <span className="text-foreground">{usdcInfo.assetIssuer}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Payments in any other USDC (different issuer) are ignored and will not
                        be credited.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Destination (sponsor)
                      </p>
                      <p className="break-all font-mono text-xs">{usdcInfo.address}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(usdcInfo.address, 'address')}
                      >
                        {copied === 'address' ? 'Copied' : 'Copy address'}
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Memo (type: Hash) — required for attribution
                      </p>
                      <p className="break-all font-mono text-xs">{usdcInfo.memo}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(usdcInfo.memo, 'memo')}
                      >
                        {copied === 'memo' ? 'Copied' : 'Copy memo hex'}
                      </Button>
                    </div>

                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-3">
                      <QRCodeSVG value={usdcInfo.address} size={160} bgColor="transparent" />
                      <p className="text-center text-xs text-muted-foreground">
                        QR encodes the Stellar address — set memo type Hash and paste the hex
                        in your wallet before sending.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshBalance()}
                    >
                      Check for deposits
                    </Button>

                    {usdcCredits.length > 0 ? (
                      <div className="rounded-md border border-border bg-secondary/40 p-3">
                        <p className="font-medium">Newly credited</p>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {usdcCredits.map((c) => (
                            <li key={c.txHash}>
                              {formatUSDC(c.amount)} ·{' '}
                              <span className="font-mono">{c.txHash.slice(0, 12)}…</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Deposit fiat → USDC</CardTitle>
              <p className="text-sm text-muted-foreground">
                Creates a live Etherfuse on-ramp order. After it completes, you go straight to
                Create.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={onDeposit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Currency</span>
                  <div className="flex gap-2">
                    {(['BRL', 'MXN'] as const).map((c) => (
                      <Button
                        key={c}
                        type="button"
                        variant={currency === c ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrency(c)}
                      >
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiat-amount" className="text-sm font-medium">
                    Amount ({currency})
                  </label>
                  <Input
                    id="fiat-amount"
                    type="number"
                    min={1}
                    max={SANDBOX_FIAT_MAX}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    1–{SANDBOX_FIAT_MAX} {currency} · sandbox cap applies to both currencies
                  </p>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={pending}>
                  {pending ? 'Creating order…' : `Create ${currency} deposit`}
                </Button>
              </form>

              {instructions ? (
                <div className="mt-4 space-y-3 rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">
                    {instructions.rail === 'pix' ? 'PIX deposit' : 'SPEI deposit'}
                  </p>

                  {instructions.rail === 'pix' ? (
                    <>
                      <p>
                        Rail:{' '}
                        <span className="font-medium">{instructions.depositBankName}</span>
                      </p>
                      <p>
                        Amount:{' '}
                        <span className="font-mono">
                          {instructions.depositAmount} {currency}
                        </span>
                      </p>
                      <p>Recipient: {instructions.depositAccountHolder}</p>

                      {showPixCopyPaste ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Pix copia e cola — pay from your banking app
                          </p>
                          <p className="break-all rounded-md bg-secondary p-2 font-mono text-xs">
                            {instructions.pixCopyPaste}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void copyText(instructions.pixCopyPaste!, 'pix')}
                          >
                            {copied === 'pix' ? 'Copied' : 'Copy Pix code'}
                          </Button>
                          <div className="flex flex-col items-center gap-1 pt-2">
                            <QRCodeSVG
                              value={instructions.pixCopyPaste!}
                              size={160}
                              bgColor="transparent"
                            />
                            <p className="text-xs text-muted-foreground">
                              Pix QR — scan in your banking app
                            </p>
                          </div>
                        </div>
                      ) : instructions.statusPage ? (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Payment instructions are not in the API response. Open the
                            Etherfuse order page and tap{' '}
                            <strong className="text-foreground">Get Transfer Details</strong>.
                            In sandbox (verified 2026-08-06) that modal shows the BRL amount
                            but no Pix copia-e-cola and no payable Pix QR — use Etherfuse
                            sandbox tools to simulate fiat receipt, then return here.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            render={
                              <a
                                href={instructions.statusPage}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                          >
                            Abrir página de pagamento
                          </Button>
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <QRCodeSVG
                              value={instructions.statusPage}
                              size={160}
                              bgColor="transparent"
                            />
                            <p className="max-w-[14rem] text-center text-xs text-muted-foreground">
                              QR opens the order page — not a Pix code for your bank app
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void copyText(instructions.statusPage!, 'status')}
                          >
                            {copied === 'status' ? 'Copied link' : 'Copy order page link'}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
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
                          {instructions.depositAmount} {currency}
                        </span>
                      </p>
                      <p>Holder: {instructions.depositAccountHolder}</p>
                    </>
                  )}

                  {quotedUsdc != null ? (
                    <p>Credits ≈ {formatUSDC(quotedUsdc)} when the order completes</p>
                  ) : null}
                  {orderId ? (
                    <p className="text-muted-foreground">
                      Order <span className="font-mono">{orderId}</span> — status:{' '}
                      {orderStatus ?? '…'}
                    </p>
                  ) : null}
                  {depositNote ? (
                    <p className="text-xs text-muted-foreground">{depositNote}</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
          )}
        </div>

        {pendingOrders.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending deposits</CardTitle>
              <p className="text-sm text-muted-foreground">
                Orders waiting on Etherfuse. Status is refreshed on every page load; use Check
                status after completing payment in the sandbox.
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
