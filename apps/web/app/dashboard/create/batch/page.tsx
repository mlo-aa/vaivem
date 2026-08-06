'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { formatUSDC } from '@/lib/format'
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
        out.push({
          line: row.line,
          recipientName: row.recipientName,
          recipientEmail: row.recipientEmail,
          amount: row.amount,
          message: row.message,
          status: 'error',
          error: err instanceof Error ? err.message : 'create failed',
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
        <DashboardTopbar title="Batch claims" />
        <main className="flex-1 p-4 sm:p-6">
          <Skeleton className="mx-auto h-64 max-w-lg w-full" />
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardTopbar title="Batch claims" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Upload a CSV to create many claims at once. Available balance:{' '}
            <span className="font-medium text-foreground tabular-nums">
              {formatUSDC(balance ?? 0)}
            </span>
          </p>
          <Link
            href="/dashboard/create"
            className="text-sm text-foreground underline underline-offset-2"
          >
            Create a single claim instead
          </Link>
        </div>

        {stage === 'upload' || stage === 'preview' ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV</CardTitle>
              <p className="text-sm text-muted-foreground">
                Columns: <code className="text-xs">recipient_name</code>,{' '}
                <code className="text-xs">recipient_email</code>,{' '}
                <code className="text-xs">amount</code> (USDC),{' '}
                <code className="text-xs">message</code>. PIX minimum applies (
                1.00 USDC per row).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">File: {fileName}</p>
              ) : null}

              {validation && validation.errors.length > 0 ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">Validation errors</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    {validation.errors.map((e, i) => (
                      <li key={`${e.line}-${i}`}>
                        {e.line > 0 ? `Line ${e.line}: ` : ''}
                        {e.message}
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
              <CardTitle>Preview</CardTitle>
              <p className="text-sm text-muted-foreground">
                {previewRows.length} claim{previewRows.length === 1 ? '' : 's'} · total{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatUSDC(validation.totalUsdc)}
                </span>
                . Nothing is created until you confirm.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">USDC</TableHead>
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
                          {formatUSDC(row.amount)}
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
                  Confirm and create {previewRows.length} claims
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
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {stage === 'creating' ? (
          <Card>
            <CardHeader>
              <CardTitle>Creating claims…</CardTitle>
              <p className="text-sm text-muted-foreground">
                {progress} / {validation?.rows.length ?? 0}
                {batchId ? (
                  <>
                    {' '}
                    · batch <span className="font-mono">{batchId}</span>
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
              <CardTitle>Batch complete</CardTitle>
              <p className="text-sm text-muted-foreground">
                {okCount} succeeded
                {failCount > 0 ? `, ${failCount} failed` : ''}.
                {batchId ? (
                  <>
                    {' '}
                    Batch id <span className="font-mono">{batchId}</span>
                  </>
                ) : null}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Link / error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell>{r.status === 'ok' ? 'OK' : 'Error'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{r.recipientName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatUSDC(r.amount)}
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
                  Download results CSV
                </Button>
                <ButtonLink href="/dashboard">View claims</ButtonLink>
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
                  Upload another
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  )
}
