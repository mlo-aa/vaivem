/**
 * CSV batch claim helpers (client-safe).
 * Expected columns: recipient_name, recipient_email, amount, message
 */

import { isBelowMinimum, MIN_AMOUNT_USDC } from "@/lib/limits"

export type BatchCsvRow = {
  line: number
  recipientName: string
  recipientEmail: string
  amount: number
  message: string
}

export type BatchRowError = {
  line: number
  message: string
}

export type BatchValidation = {
  rows: BatchCsvRow[]
  errors: BatchRowError[]
  totalUsdc: number
  ok: boolean
}

/** Minimal RFC4180-ish CSV parse (handles quoted fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, "")

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    const next = src[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++
      row.push(field)
      field = ""
      if (row.some((c) => c.trim() !== "")) rows.push(row)
      row = []
      continue
    }
    field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== "")) rows.push(row)
  return rows
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

const REQUIRED = ["recipient_name", "recipient_email", "amount", "message"] as const

export function validateBatchCsv(
  text: string,
  options: {
    availableBalance: number
    allowPix?: boolean
  },
): BatchValidation {
  const allowPix = options.allowPix !== false
  const table = parseCsv(text)
  const errors: BatchRowError[] = []

  if (table.length < 2) {
    return {
      rows: [],
      errors: [{ line: 1, message: "CSV needs a header row and at least one data row." }],
      totalUsdc: 0,
      ok: false,
    }
  }

  const headers = table[0].map(normHeader)
  const missing = REQUIRED.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Missing columns: ${missing.join(", ")}. Expected: ${REQUIRED.join(", ")}`,
        },
      ],
      totalUsdc: 0,
      ok: false,
    }
  }

  const idx = {
    name: headers.indexOf("recipient_name"),
    email: headers.indexOf("recipient_email"),
    amount: headers.indexOf("amount"),
    message: headers.indexOf("message"),
  }

  const rows: BatchCsvRow[] = []
  for (let i = 1; i < table.length; i++) {
    const line = i + 1
    const cells = table[i]
    const recipientName = String(cells[idx.name] ?? "").trim()
    const recipientEmail = String(cells[idx.email] ?? "").trim()
    const amountRaw = String(cells[idx.amount] ?? "").trim().replace(",", ".")
    const message = String(cells[idx.message] ?? "").trim()
    const amount = Number(amountRaw)

    if (recipientName.length < 2) {
      errors.push({ line, message: "recipient_name must be at least 2 characters" })
      continue
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      errors.push({ line, message: "recipient_email is not a valid email" })
      continue
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line, message: "amount must be a positive number (USDC)" })
      continue
    }
    if (allowPix && isBelowMinimum(amount)) {
      errors.push({
        line,
        message: `amount below PIX minimum (${MIN_AMOUNT_USDC} USDC)`,
      })
      continue
    }

    rows.push({ line, recipientName, recipientEmail, amount, message })
  }

  const totalUsdc =
    Math.round(rows.reduce((sum, r) => sum + r.amount, 0) * 100) / 100

  if (rows.length > 0 && totalUsdc > options.availableBalance + 1e-9) {
    errors.push({
      line: 0,
      message: `Total ${totalUsdc.toFixed(2)} USDC exceeds available balance ${options.availableBalance.toFixed(2)} USDC.`,
    })
  }

  return {
    rows,
    errors,
    totalUsdc,
    ok: errors.length === 0 && rows.length > 0,
  }
}

export function resultsToCsv(
  results: Array<{
    line: number
    recipientName: string
    recipientEmail: string
    amount: number
    message: string
    status: "ok" | "error"
    token?: string
    url?: string
    error?: string
  }>,
): string {
  const header =
    "line,recipient_name,recipient_email,amount,message,status,token,url,error"
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const lines = results.map((r) =>
    [
      String(r.line),
      escape(r.recipientName),
      escape(r.recipientEmail),
      r.amount.toFixed(2),
      escape(r.message),
      r.status,
      escape(r.token ?? ""),
      escape(r.url ?? ""),
      escape(r.error ?? ""),
    ].join(","),
  )
  return [header, ...lines].join("\n")
}
