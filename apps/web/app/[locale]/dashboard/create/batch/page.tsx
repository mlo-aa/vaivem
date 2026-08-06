'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorKey, formatUSDC } from '@/lib/format'
import { useSenderBalance } from '@/lib/use-sender-balance'
import { createClaim } from '@/lib/services'
import { claimShareUrl } from '@/components/share-panel'
import {
  resultsToCsv,
  validateBatchCsv,
  type BatchCsvRow,
  type BatchValidation,
} from '@/lib/batch-csv'

type Stage = 'upload' | 'preview' | 'creating' | 'done'

type RowResult = {
  line: number
  recipientName: string
  recipientEmail: string
  amount: number
  message: string
  status: 'ok' | 'error'
  token?: string
  url?: string
  error?: string
}

function newBatchId(): string {
  return `bat_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export default function BatchCreatePage() {
  const t = useTranslations('batch')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const locale = useLocale()
  const router = useRouter()
  const { balance, loading, funded, refresh } = useSenderBalance()
  const [stage, setStage] = useState<Stage>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [validation, setValidation] = useState<BatchValidation | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<RowResult[]>([])
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!funded) router.replace('/dashboard/funding')
  }, [loading, funded, router])

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setFileName(file.name)
      setCreateError(null)
      const text = await file.text()
      const next = validateBatchCsv(text, {
        availableBalance: balance ?? 0,
        allowPix: true,
      })
      setValidation(next)
      setStage(next.ok ? 'preview' : 'upload')
    },
    [balance],
  )

  const previewRows = validation?.rows ?? []

  async function confirmCreate() {
    if (!validation?.ok || validation.rows.length === 0) return
    const id = newBatchId()
    setBatchId(id)
    setStage('creating')
    setProgress(0)
    setResults([])
    setCreateError(null)

    const out: RowResult[] = []
    for (let i = 0; i < validation.rows.length; i++) {
      const row = validation.rows[i]
      try {
        const claim = await createClaim({
          amount: row.amount,
          fundingUsdc: row.amount,
          displayCurrency: 'USD',
          recipientCountry: 'BR',
          purpose: 'Batch payout',
          message: row.message || undefined,
          protectionType: 'public',
          recipientName: row.recipientName,
          recipientEmail: row.recipientEmail,
          expirationDays: 7,
          allowPix: true,
          allowStellar: true,
          batchId: id,
        })
        out.push({
          line: row.line,
          recipientName: row.recipientName,
          recipientEmail: row.recipientEmail,
          amount: row.amount,
          message: row.message,
          status: 'ok',
          token: claim.token,
          url: claimShareUrl(claim.token),
        })
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'create_failed'
        const key = apiErrorKey(raw)
        let errorLabel: string
        try {
          errorLabel =
            key === 'amount_below_minimum'
              ? tErrors('amount_below_minimum', { min: '1.00' })
              : tErrors.has(key as 'create_failed')
                ? tErrors(key as 'create_failed')
                : tErrors('create_failed')
        } catch {
          errorLabel = tErrors('create_failed')
        }
        out.push({
          line: row.line,
          recipientName: row.recipientName,
          recipientEmail: row.recipientEmail,
          amount: row.amount,
          message: row.message,
          status: 'error',
          error: errorLabel,
        })
      }
      setResults([...out])
      setProgress(i + 1)
      void refresh()
    }

    setStage('done')
  }

  function downloadResults() {
    const csv = resultsToCsv(results)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vaivem-batch-${batchId ?? 'results'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const okCount = useMemo(
    () => results.filter((r) => r.status === 'ok').length,
    [results],
  )
  const failCount = useMemo(
    () => results.filter((r) => r.status === 'error').length,
    [results],
  )

  if (loading || balance === 0) {
    return (
      <>
        <DashboardTopbar title={t('title')} />
        <main className="flex-1 p-4 sm:p-6">
          <Skeleton className="mx-auto h-64 max-w-lg w-full" />
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardTopbar title={t('title')} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t('available', { balance: formatUSDC(balance ?? 0, locale) })}
          </p>
          <Link
            href="/dashboard/create"
            className="text-sm text-foreground underline underline-offset-2"
          >
            {t('singleInstead')}
          </Link>
        </div>

        {stage === 'upload' || stage === 'preview' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('uploadTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('uploadHint', { min: '1.00' })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">
                  {t('fileLabel', { name: fileName })}
                </p>
              ) : null}

              {validation && validation.errors.length > 0 ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    {t('validationErrors')}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    {validation.errors.map((e, i) => (
                      <li key={`${e.line}-${i}`}>
                        {e.line > 0
                          ? t('lineError', { line: e.line, message: e.message })
                          : e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {stage === 'preview' && validation?.ok ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('previewTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('previewSummary', {
                  count: previewRows.length,
                  total: formatUSDC(validation.totalUsdc, locale),
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('columns.line')}</TableHead>
                      <TableHead>{t('columns.recipient')}</TableHead>
                      <TableHead>{t('columns.email')}</TableHead>
                      <TableHead className="text-right">{t('columns.usdc')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row: BatchCsvRow) => (
                      <TableRow key={row.line}>
                        <TableCell className="tabular-nums">{row.line}</TableCell>
                        <TableCell>{row.recipientName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.recipientEmail}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUSDC(row.amount, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void confirmCreate()}>
                  {t('confirm', { count: previewRows.length })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStage('upload')
                    setValidation(null)
                    setFileName(null)
                  }}
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {stage === 'creating' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('creating')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('progress', {
                  current: progress,
                  total: validation?.rows.length ?? 0,
                })}
                {batchId ? (
                  <>
                    {' '}
                    · {t('batchId', { id: batchId })}
                  </>
                ) : null}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{
                    width: `${
                      validation?.rows.length
                        ? (progress / validation.rows.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {stage === 'done' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('doneTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('doneSummary', {
                  ok: okCount,
                  fail: failCount > 0 ? t('failPart', { n: failCount }) : '',
                })}
                {batchId ? (
                  <>
                    {' '}
                    {t('batchId', { id: batchId })}
                  </>
                ) : null}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('columns.status')}</TableHead>
                      <TableHead>{t('columns.recipient')}</TableHead>
                      <TableHead>{t('columns.link')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell>
                          {r.status === 'ok' ? t('statusOk') : t('statusError')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{r.recipientName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatUSDC(r.amount, locale)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs">
                          {r.status === 'ok' ? (
                            <a
                              href={r.url}
                              className="font-mono text-foreground underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {r.token}
                            </a>
                          ) : (
                            <span className="text-destructive">{r.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={downloadResults}>
                  {t('downloadResults')}
                </Button>
                <ButtonLink href="/dashboard">{t('viewClaims')}</ButtonLink>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStage('upload')
                    setValidation(null)
                    setFileName(null)
                    setResults([])
                    setBatchId(null)
                    setProgress(0)
                  }}
                >
                  {t('uploadAnother')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  )
}
