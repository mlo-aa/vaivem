'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from '@/i18n/navigation'
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
import { apiErrorKey, formatUSDC, toBcp47 } from '@/lib/format'

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

const ERRORS_KEYS = new Set([
  'Unauthorized',
  'insufficient_balance',
  'amount_below_minimum',
  'amount_above_sandbox_limit',
  'currency_invalid',
  'amount_invalid',
  'recipientName_required',
  'accessCode_required',
  'at_least_one_rail',
  'create_failed',
  'network',
  'auth_misconfigured',
  'unknown',
])

function hasPixCopyPaste(instructions: DepositInstructions): boolean {
  return Boolean(instructions.pixCopyPaste?.trim())
}

export default function FundingPage() {
  const t = useTranslations('funding')
  const tCustody = useTranslations('custody')
  const tErrors = useTranslations('errors')
  const tCommon = useTranslations('common')
  const locale = useLocale()
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

  function translateDataError(
    code: string | undefined | null,
    fallback: 'deposit_failed' | 'check_failed',
  ): string {
    const key = apiErrorKey(code)
    if (key === 'amount_above_sandbox_limit') {
      return t('errors.amount_above_sandbox_limit', {
        max: SANDBOX_FIAT_MAX,
        currency,
      })
    }
    if (ERRORS_KEYS.has(key)) {
      if (key === 'amount_below_minimum') {
        return tErrors('amount_below_minimum', { min: '1.00' })
      }
      return tErrors(key as 'unknown')
    }
    return t(`errors.${fallback}`)
  }

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
        setError(translateDataError(data.error, 'deposit_failed'))
        return
      }
      setOrderId(String(data.orderId))
      setOrderStatus('created')
      setQuotedUsdc(Number(data.usdcAmount))
      setInstructions(data.instructions ?? null)
      setDepositNote(typeof data.note === 'string' ? data.note : null)
      await refreshBalance()
    } catch {
      setError(t('errors.reach_failed'))
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
      setError(t('errors.clipboard_failed'))
    }
  }

  async function checkStatus(id: string) {
    setCheckingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/funding/${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(translateDataError(data.error, 'check_failed'))
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
      setError(t('errors.reach_failed'))
    } finally {
      setCheckingId(null)
    }
  }

  const showPixCopyPaste = instructions ? hasPixCopyPaste(instructions) : false
  const dateLocale = toBcp47(locale)

  return (
    <>
      <DashboardTopbar title={t('title')} />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{tCustody('line')}</p>

        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
          <p className="font-medium">{t('sandboxTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('sandboxBody', { max: SANDBOX_FIAT_MAX })}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={method === 'fiat' ? 'default' : 'outline'}
            onClick={() => setMethod('fiat')}
          >
            {t('methodFiat')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={method === 'usdc' ? 'default' : 'outline'}
            onClick={() => setMethod('usdc')}
          >
            {t('methodUsdc')}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('balanceTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{tCustody('line')}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold tabular-nums">
                {balance == null ? '—' : formatUSDC(balance, locale)}
              </p>
              {(balance ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="/dashboard/create">{t('createClaim')}</ButtonLink>
                  <ButtonLink href="/dashboard/create/batch" variant="outline">
                    {t('batchCsv')}
                  </ButtonLink>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {method === 'usdc' ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('usdcTitle')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('usdcBody')}</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!usdcInfo ? (
                  <p className="text-muted-foreground">{t('loadingUsdc')}</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('requiredAsset')}
                      </p>
                      <p className="font-mono text-xs break-all">
                        {usdcInfo.assetCode}:
                        <span className="text-foreground">{usdcInfo.assetIssuer}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('otherUsdcIgnored')}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('destination')}
                      </p>
                      <p className="break-all font-mono text-xs">{usdcInfo.address}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(usdcInfo.address, 'address')}
                      >
                        {copied === 'address' ? tCommon('copied') : t('copyAddress')}
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('memoLabel')}
                      </p>
                      <p className="break-all font-mono text-xs">{usdcInfo.memo}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(usdcInfo.memo, 'memo')}
                      >
                        {copied === 'memo' ? tCommon('copied') : t('copyMemo')}
                      </Button>
                    </div>

                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-3">
                      <QRCodeSVG value={usdcInfo.address} size={160} bgColor="transparent" />
                      <p className="text-center text-xs text-muted-foreground">
                        {t('addressQrHint')}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshBalance()}
                    >
                      {t('checkDeposits')}
                    </Button>

                    {usdcCredits.length > 0 ? (
                      <div className="rounded-md border border-border bg-secondary/40 p-3">
                        <p className="font-medium">{t('newlyCredited')}</p>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {usdcCredits.map((c) => (
                            <li key={c.txHash}>
                              {formatUSDC(c.amount, locale)} ·{' '}
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
                <CardTitle>{t('fiatTitle')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('fiatBody')}</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={onDeposit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('currency')}</span>
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
                      {t('amountLabel', { currency })}
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
                      {t('amountHint', { max: SANDBOX_FIAT_MAX, currency })}
                    </p>
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" disabled={pending}>
                    {pending
                      ? t('creatingOrder')
                      : t('createDeposit', { currency })}
                  </Button>
                </form>

                {instructions ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">
                      {instructions.rail === 'pix' ? t('pixDeposit') : t('speiDeposit')}
                    </p>

                    {instructions.rail === 'pix' ? (
                      <>
                        <p>{t('rail', { name: instructions.depositBankName })}</p>
                        <p>
                          {t('amountLine', {
                            amount: instructions.depositAmount,
                            currency,
                          })}
                        </p>
                        <p>
                          {t('recipient', { name: instructions.depositAccountHolder })}
                        </p>

                        {showPixCopyPaste ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {t('pixCopyTitle')}
                            </p>
                            <p className="break-all rounded-md bg-secondary p-2 font-mono text-xs">
                              {instructions.pixCopyPaste}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void copyText(instructions.pixCopyPaste!, 'pix')
                              }
                            >
                              {copied === 'pix' ? tCommon('copied') : t('copyPix')}
                            </Button>
                            <div className="flex flex-col items-center gap-1 pt-2">
                              <QRCodeSVG
                                value={instructions.pixCopyPaste!}
                                size={160}
                                bgColor="transparent"
                              />
                              <p className="text-xs text-muted-foreground">
                                {t('pixQrHint')}
                              </p>
                            </div>
                          </div>
                        ) : instructions.statusPage ? (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              {t('statusPageHint')}
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
                              {t('openPaymentPage')}
                            </Button>
                            <div className="flex flex-col items-center gap-1 pt-1">
                              <QRCodeSVG
                                value={instructions.statusPage}
                                size={160}
                                bgColor="transparent"
                              />
                              <p className="max-w-[14rem] text-center text-xs text-muted-foreground">
                                {t('statusQrHint')}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void copyText(instructions.statusPage!, 'status')
                              }
                            >
                              {copied === 'status'
                                ? t('copiedLink')
                                : t('copyOrderLink')}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p>{t('bank', { name: instructions.depositBankName })}</p>
                        <p>
                          {t('clabe', { clabe: instructions.depositClabe || '—' })}
                        </p>
                        <p>
                          {t('amountLine', {
                            amount: instructions.depositAmount,
                            currency,
                          })}
                        </p>
                        <p>
                          {t('holder', { name: instructions.depositAccountHolder })}
                        </p>
                      </>
                    )}

                    {quotedUsdc != null ? (
                      <p>
                        {t('creditsApprox', {
                          usdc: formatUSDC(quotedUsdc, locale),
                        })}
                      </p>
                    ) : null}
                    {orderId ? (
                      <p className="text-muted-foreground">
                        {t('orderStatus', {
                          id: orderId,
                          status: orderStatus ?? '…',
                        })}
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
              <CardTitle>{t('pendingTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('pendingBody')}</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('when')}</TableHead>
                    <TableHead>{t('order')}</TableHead>
                    <TableHead>{t('fiat')}</TableHead>
                    <TableHead>{tCommon('usdc')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((row) => (
                    <TableRow key={row.orderId}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString(dateLocale)}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                        {row.orderId}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.fiatAmount} {row.currency}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatUSDC(row.usdcAmount, locale)}
                      </TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={checkingId === row.orderId}
                          onClick={() => void checkStatus(row.orderId)}
                        >
                          {checkingId === row.orderId
                            ? t('checking')
                            : t('checkStatus')}
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
            <CardTitle>{t('ledgerTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noEntries')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('when')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('amount')}</TableHead>
                    <TableHead>{t('ref')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString(dateLocale)}
                      </TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatUSDC(row.amount, locale)}
                      </TableCell>
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
