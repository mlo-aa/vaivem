"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert, Upload, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { StatusBadge } from "@/components/status-badge"
import { formatUSDC } from "@/lib/format"
import { createBatchClaims } from "@/lib/services"
import type { BatchRecipient } from "@/lib/types"

const SAMPLE = `recipient_name,recipient_email,amount,currency,country
Ana Ribeiro,ana@example.com,500,BRL,BR
Carlos Mendes,carlos@example.com,120,USD,BR
Júlia Souza,julia@example.com,750,BRL,BR
Pedro Alves,pedro@example.com,300,BRL,BR`

type Stage = "input" | "review" | "processing" | "done"

function parseCsv(text: string): BatchRecipient[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const header = lines[0].toLowerCase().includes("recipient_name")
  const rows = header ? lines.slice(1) : lines
  return rows.map((line) => {
    const [recipient_name = "", recipient_email = "", amount = "", currency = "BRL", country = "BR"] =
      line.split(",").map((s) => s.trim())
    const errors: string[] = []
    if (!recipient_name) errors.push("Missing name")
    if (!recipient_email || !recipient_email.includes("@")) errors.push("Invalid email")
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) errors.push("Invalid amount")
    return { recipient_name, recipient_email, amount, currency, country, errors }
  })
}

export function BatchPayouts() {
  const [text, setText] = useState("")
  const [stage, setStage] = useState<Stage>("input")
  const [recipients, setRecipients] = useState<BatchRecipient[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const parsed = useMemo(() => parseCsv(text), [text])
  const validCount = parsed.filter((r) => !r.errors?.length).length
  const errorCount = parsed.length - validCount
  const totalUsdc = parsed
    .filter((r) => !r.errors?.length)
    .reduce((sum, r) => {
      const usd = r.currency === "BRL" ? Number(r.amount) / 5.045 : Number(r.amount)
      return sum + usd
    }, 0)

  function handleReview() {
    setRecipients(parsed)
    setStage("review")
  }

  async function handleSend() {
    setStage("processing")
    const valid = recipients.filter((r) => !r.errors?.length)
    setProgress({ done: 0, total: valid.length })
    await createBatchClaims(valid, (done, total) => setProgress({ done, total }))
    setStage("done")
  }

  return (
    <div className="flex flex-col gap-6">
      {stage === "input" ? (
        <Card>
          <CardHeader>
            <CardTitle>Import recipients</CardTitle>
            <CardDescription>
              Paste CSV data or upload a file. Each row becomes a funded ClaimLink.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setText(SAMPLE)}>
                <FileSpreadsheet data-icon="inline-start" />
                Load sample data
              </Button>
              <Button variant="outline" size="sm">
                <Upload data-icon="inline-start" />
                Upload CSV
              </Button>
              <Button variant="ghost" size="sm">
                <Download data-icon="inline-start" />
                Download template
              </Button>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={SAMPLE}
              className="min-h-48 font-mono text-sm"
              aria-label="CSV recipient data"
            />
            {parsed.length > 0 ? (
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="secondary">{parsed.length} rows</Badge>
                <span className="flex items-center gap-1 text-brand">
                  <CheckCircle2 className="size-4" />
                  {validCount} valid
                </span>
                {errorCount > 0 ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <TriangleAlert className="size-4" />
                    {errorCount} with errors
                  </span>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {stage === "input" && parsed.length > 0 ? (
        <div className="flex justify-end">
          <Button onClick={handleReview} disabled={validCount === 0}>
            Review {validCount} payouts
          </Button>
        </div>
      ) : null}

      {stage === "input" && parsed.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No recipients yet</EmptyTitle>
            <EmptyDescription>
              Paste CSV data above or load the sample to see how batch payouts work.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {stage === "review" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryStat label="Recipients" value={String(validCount)} />
            <SummaryStat label="Total to send" value={formatUSDC(Math.round(totalUsdc * 100) / 100)} />
            <SummaryStat label="Errors skipped" value={String(errorCount)} />
          </div>
          {errorCount > 0 ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>{errorCount} rows will be skipped</AlertTitle>
              <AlertDescription>
                Rows with validation errors won&apos;t be funded. Fix them and re-import to include them.
              </AlertDescription>
            </Alert>
          ) : null}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r, i) => {
                  const invalid = (r.errors?.length ?? 0) > 0
                  return (
                    <TableRow key={i} data-invalid={invalid}>
                      <TableCell className="font-medium">{r.recipient_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.recipient_email || "—"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.amount ? `${r.amount} ${r.currency}` : "—"}
                      </TableCell>
                      <TableCell>
                        {invalid ? (
                          <Badge variant="destructive">{r.errors?.[0]}</Badge>
                        ) : (
                          <Badge variant="secondary">Ready</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStage("input")}>
              Back
            </Button>
            <Button onClick={handleSend} disabled={validCount === 0}>
              Fund {validCount} ClaimLinks
            </Button>
          </div>
        </>
      ) : null}

      {stage === "processing" ? (
        <Card>
          <CardHeader>
            <CardTitle>Creating your ClaimLinks</CardTitle>
            <CardDescription>
              Funding {progress.total} payouts on Stellar…
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="text-sm text-muted-foreground tabular-nums">
              {progress.done} of {progress.total} funded
            </p>
          </CardContent>
        </Card>
      ) : null}

      {stage === "done" ? (
        <Card className="border-brand/40">
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-brand/15 text-brand">
              <CheckCircle2 className="size-7" />
            </span>
            <CardTitle>{progress.total} ClaimLinks created</CardTitle>
            <CardDescription>
              Every recipient has been emailed their unique claim link.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <StatusBadge status="shared" />
            <Button
              variant="outline"
              onClick={() => {
                setText("")
                setRecipients([])
                setStage("input")
              }}
            >
              Start another batch
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
