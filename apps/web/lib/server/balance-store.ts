/**
 * Per-sender USDC demo ledger (internal accounting, not custody segregation).
 * KV when configured; in-memory otherwise — same pattern as claim-secrets.
 */

import "server-only"

import { kv } from "@vercel/kv"

const BALANCE_PREFIX = "balance:"
const LEDGER_PREFIX = "ledger:"
const PENDING_PREFIX = "funding:"
const LEDGER_MAX = 200

export type LedgerEntryType = "deposit" | "claim_funded" | "refund"

export interface LedgerEntry {
  id: string
  type: LedgerEntryType
  amount: number
  ref: string
  createdAt: string
}

export interface SenderBalance {
  ownerId: string
  amount: number
  updatedAt: string
}

export interface PendingDeposit {
  orderId: string
  ownerId: string
  currency: "MXN" | "BRL"
  fiatAmount: number
  usdcAmount: number
  createdAt: string
  credited: boolean
}

const memoryBalances = new Map<string, SenderBalance>()
const memoryLedgers = new Map<string, LedgerEntry[]>()
const memoryPending = new Map<string, PendingDeposit>()

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function balanceKey(ownerId: string) {
  return `${BALANCE_PREFIX}${ownerId}`
}

function ledgerKey(ownerId: string) {
  return `${LEDGER_PREFIX}${ownerId}`
}

function pendingKey(orderId: string) {
  return `${PENDING_PREFIX}${orderId}`
}

function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

export async function getBalance(ownerId: string): Promise<SenderBalance> {
  if (kvConfigured()) {
    const row = await kv.get<SenderBalance>(balanceKey(ownerId))
    if (row) return row
  } else {
    const row = memoryBalances.get(ownerId)
    if (row) return row
  }
  return {
    ownerId,
    amount: 0,
    updatedAt: new Date().toISOString(),
  }
}

export async function getLedger(ownerId: string): Promise<LedgerEntry[]> {
  if (kvConfigured()) {
    return (await kv.get<LedgerEntry[]>(ledgerKey(ownerId))) ?? []
  }
  return memoryLedgers.get(ownerId) ?? []
}

async function writeBalance(balance: SenderBalance): Promise<void> {
  if (kvConfigured()) {
    await kv.set(balanceKey(balance.ownerId), balance)
  } else {
    memoryBalances.set(balance.ownerId, balance)
  }
}

async function appendLedger(ownerId: string, entry: LedgerEntry): Promise<void> {
  const list = await getLedger(ownerId)
  const next = [entry, ...list].slice(0, LEDGER_MAX)
  if (kvConfigured()) {
    await kv.set(ledgerKey(ownerId), next)
  } else {
    memoryLedgers.set(ownerId, next)
  }
}

async function applyDelta(
  ownerId: string,
  delta: number,
  entry: Omit<LedgerEntry, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<SenderBalance> {
  const current = await getBalance(ownerId)
  const amount = roundUsdc(current.amount + delta)
  if (amount < -0.0001) {
    throw new Error("insufficient_balance")
  }
  const balance: SenderBalance = {
    ownerId,
    amount: Math.max(0, amount),
    updatedAt: new Date().toISOString(),
  }
  await writeBalance(balance)
  await appendLedger(ownerId, {
    id: entry.id ?? crypto.randomUUID(),
    type: entry.type,
    amount: roundUsdc(Math.abs(entry.amount)),
    ref: entry.ref,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  })
  return balance
}

/** Credit USDC after a completed on-ramp. Idempotent via pending.credited / ledger ref. */
export async function creditDeposit(
  ownerId: string,
  usdcAmount: number,
  orderId: string,
): Promise<SenderBalance> {
  const ledger = await getLedger(ownerId)
  if (ledger.some((e) => e.type === "deposit" && e.ref === orderId)) {
    return getBalance(ownerId)
  }
  return applyDelta(ownerId, usdcAmount, {
    type: "deposit",
    amount: usdcAmount,
    ref: orderId,
  })
}

/** Debit when creating a claim. Throws if short. */
export async function debitForClaim(
  ownerId: string,
  usdcAmount: number,
  claimToken: string,
): Promise<SenderBalance> {
  const current = await getBalance(ownerId)
  if (current.amount + 1e-9 < usdcAmount) {
    const err = new Error("insufficient_balance")
    ;(err as Error & { available: number; required: number }).available = current.amount
    ;(err as Error & { available: number; required: number }).required = usdcAmount
    throw err
  }
  return applyDelta(ownerId, -usdcAmount, {
    type: "claim_funded",
    amount: usdcAmount,
    ref: claimToken,
  })
}

/** Credit back on cancel/refund of an unclaimed claim. */
export async function creditRefund(
  ownerId: string,
  usdcAmount: number,
  claimToken: string,
): Promise<SenderBalance> {
  return applyDelta(ownerId, usdcAmount, {
    type: "refund",
    amount: usdcAmount,
    ref: claimToken,
  })
}

export async function savePendingDeposit(pending: PendingDeposit): Promise<void> {
  if (kvConfigured()) {
    await kv.set(pendingKey(pending.orderId), pending, { ex: 60 * 60 * 24 * 7 })
  } else {
    memoryPending.set(pending.orderId, pending)
  }
}

export async function getPendingDeposit(
  orderId: string,
): Promise<PendingDeposit | null> {
  if (kvConfigured()) {
    return (await kv.get<PendingDeposit>(pendingKey(orderId))) ?? null
  }
  return memoryPending.get(orderId) ?? null
}

export async function markPendingCredited(orderId: string): Promise<PendingDeposit | null> {
  const pending = await getPendingDeposit(orderId)
  if (!pending) return null
  if (pending.credited) return pending
  const next = { ...pending, credited: true }
  await savePendingDeposit(next)
  return next
}
