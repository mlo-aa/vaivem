/**
 * Per-sender USDC demo ledger (internal accounting, not custody segregation).
 * KV when configured; in-memory otherwise — same pattern as claim-secrets.
 *
 * Pending on-ramps: `funding:{orderId}` holds the deposit record;
 * `funding-pending:{ownerId}` holds the orderId list so balance GET can
 * reconcile even after the client navigates away.
 */

import "server-only"

import { kv } from "@vercel/kv"

import {
  fileBackfillOwnerPending,
  fileGetBalance,
  fileGetLedger,
  fileGetPending,
  fileHasDepositRef,
  fileMarkDepositCredited,
  fileListOwnerPending,
  fileRemovePending,
  fileSavePending,
  fileScanPendingForOwner,
  fileSetOwnerPendingList,
  fileWriteBalance,
  fileWriteLedger,
} from "@/lib/server/funding-file-store"

const BALANCE_PREFIX = "balance:"
const LEDGER_PREFIX = "ledger:"
const PENDING_PREFIX = "funding:"
const OWNER_PENDING_PREFIX = "funding-pending:"
const CREDITED_ORDER_PREFIX = "deposit-credited:"
const LEDGER_MAX = 200

export type LedgerEntryType = "deposit" | "deposit_usdc" | "claim_funded" | "refund"

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
const memoryOwnerPending = new Map<string, string[]>()

function useFileStore(): boolean {
  return !kvConfigured()
}

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

function ownerPendingKey(ownerId: string) {
  return `${OWNER_PENDING_PREFIX}${ownerId}`
}

function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

function creditedOrderKey(orderId: string) {
  return `${CREDITED_ORDER_PREFIX}${orderId}`
}

export async function isDepositCreditedGlobally(
  orderId: string,
): Promise<boolean> {
  if (kvConfigured()) {
    if (await kv.get(creditedOrderKey(orderId))) return true
  } else if (useFileStore()) {
    if (await fileHasDepositRef(orderId)) return true
  } else {
    for (const entries of memoryLedgers.values()) {
      if (
        entries.some(
          (e) =>
            (e.type === "deposit" || e.type === "deposit_usdc") &&
            e.ref === orderId,
        )
      ) {
        return true
      }
    }
  }
  return false
}

async function markDepositCreditedGlobally(orderId: string): Promise<void> {
  if (kvConfigured()) {
    await kv.set(creditedOrderKey(orderId), true)
  } else if (useFileStore()) {
    await fileMarkDepositCredited(orderId)
  }
}

export async function getBalance(ownerId: string): Promise<SenderBalance> {
  if (kvConfigured()) {
    const row = await kv.get<SenderBalance>(balanceKey(ownerId))
    if (row) return row
  } else if (useFileStore()) {
    const row = await fileGetBalance(ownerId)
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
  if (useFileStore()) {
    return fileGetLedger(ownerId)
  }
  return memoryLedgers.get(ownerId) ?? []
}

async function writeBalance(balance: SenderBalance): Promise<void> {
  if (kvConfigured()) {
    await kv.set(balanceKey(balance.ownerId), balance)
  } else if (useFileStore()) {
    await fileWriteBalance(balance)
  } else {
    memoryBalances.set(balance.ownerId, balance)
  }
}

async function appendLedger(ownerId: string, entry: LedgerEntry): Promise<void> {
  const list = await getLedger(ownerId)
  const next = [entry, ...list].slice(0, LEDGER_MAX)
  if (kvConfigured()) {
    await kv.set(ledgerKey(ownerId), next)
  } else if (useFileStore()) {
    await fileWriteLedger(ownerId, next)
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

/** Credit USDC after a completed on-ramp. Idempotent via ledger ref / global order key. */
export async function creditDeposit(
  ownerId: string,
  usdcAmount: number,
  orderId: string,
): Promise<SenderBalance> {
  if (await isDepositCreditedGlobally(orderId)) {
    return getBalance(ownerId)
  }
  const ledger = await getLedger(ownerId)
  if (ledger.some((e) => e.type === "deposit" && e.ref === orderId)) {
    await markDepositCreditedGlobally(orderId)
    return getBalance(ownerId)
  }
  const balance = await applyDelta(ownerId, usdcAmount, {
    type: "deposit",
    amount: usdcAmount,
    ref: orderId,
  })
  await markDepositCreditedGlobally(orderId)
  return balance
}

/**
 * Credit USDC from a Stellar payment (crypto deposit).
 * Ledger type `deposit_usdc`, ref = transaction hash. Idempotent on tx hash.
 */
export async function creditUsdcDeposit(
  ownerId: string,
  usdcAmount: number,
  txHash: string,
): Promise<{ balance: SenderBalance; newlyCredited: boolean }> {
  if (await isDepositCreditedGlobally(txHash)) {
    return { balance: await getBalance(ownerId), newlyCredited: false }
  }
  const ledger = await getLedger(ownerId)
  if (
    ledger.some(
      (e) =>
        (e.type === "deposit_usdc" || e.type === "deposit") && e.ref === txHash,
    )
  ) {
    await markDepositCreditedGlobally(txHash)
    return { balance: await getBalance(ownerId), newlyCredited: false }
  }
  const balance = await applyDelta(ownerId, usdcAmount, {
    type: "deposit_usdc",
    amount: usdcAmount,
    ref: txHash,
  })
  await markDepositCreditedGlobally(txHash)
  return { balance, newlyCredited: true }
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

export async function listOwnerPendingOrderIds(ownerId: string): Promise<string[]> {
  if (kvConfigured()) {
    return (await kv.get<string[]>(ownerPendingKey(ownerId))) ?? []
  }
  if (useFileStore()) {
    return fileListOwnerPending(ownerId)
  }
  return memoryOwnerPending.get(ownerId) ?? []
}

async function writeOwnerPendingList(ownerId: string, orderIds: string[]): Promise<void> {
  const unique = [...new Set(orderIds)]
  if (kvConfigured()) {
    if (unique.length === 0) {
      await kv.del(ownerPendingKey(ownerId))
    } else {
      await kv.set(ownerPendingKey(ownerId), unique, { ex: 60 * 60 * 24 * 14 })
    }
  } else if (useFileStore()) {
    await fileSetOwnerPendingList(ownerId, unique)
  } else if (unique.length === 0) {
    memoryOwnerPending.delete(ownerId)
  } else {
    memoryOwnerPending.set(ownerId, unique)
  }
}

async function addToOwnerPending(ownerId: string, orderId: string): Promise<void> {
  const list = await listOwnerPendingOrderIds(ownerId)
  if (list.includes(orderId)) return
  await writeOwnerPendingList(ownerId, [...list, orderId])
}

/**
 * Discover orphaned `funding:{orderId}` rows for this owner (created before the
 * owner-index existed) and attach them to `funding-pending:{ownerId}`.
 */
export async function backfillOwnerPendingList(ownerId: string): Promise<void> {
  const found: string[] = []

  if (kvConfigured()) {
    try {
      const keys = await kv.keys(`${PENDING_PREFIX}*`)
      for (const key of keys) {
        if (
          typeof key !== "string" ||
          key.startsWith(OWNER_PENDING_PREFIX) ||
          !key.startsWith(PENDING_PREFIX)
        ) {
          continue
        }
        const orderId = key.slice(PENDING_PREFIX.length)
        if (!orderId || orderId.includes(":")) continue
        const pending = await kv.get<PendingDeposit>(key)
        if (pending && pending.ownerId === ownerId && !pending.credited) {
          found.push(pending.orderId || orderId)
        }
      }
    } catch (err) {
      console.error(
        "[balance-store] pending backfill scan failed:",
        err instanceof Error ? err.message : err,
      )
    }
  } else if (useFileStore()) {
    for (const pending of await fileScanPendingForOwner(ownerId)) {
      if (!pending.credited) found.push(pending.orderId)
    }
  } else {
    for (const pending of memoryPending.values()) {
      if (pending.ownerId === ownerId && !pending.credited) {
        found.push(pending.orderId)
      }
    }
  }

  if (found.length === 0) return

  const existing = await listOwnerPendingOrderIds(ownerId)
  const merged = [...new Set([...existing, ...found])]
  if (merged.length === existing.length) return
  await writeOwnerPendingList(ownerId, merged)
}

export async function savePendingDeposit(pending: PendingDeposit): Promise<void> {
  if (kvConfigured()) {
    await kv.set(pendingKey(pending.orderId), pending, { ex: 60 * 60 * 24 * 7 })
  } else if (useFileStore()) {
    await fileSavePending(pending)
  } else {
    memoryPending.set(pending.orderId, pending)
  }
  await addToOwnerPending(pending.ownerId, pending.orderId)
}

export async function getPendingDeposit(
  orderId: string,
): Promise<PendingDeposit | null> {
  if (kvConfigured()) {
    return (await kv.get<PendingDeposit>(pendingKey(orderId))) ?? null
  }
  if (useFileStore()) {
    return fileGetPending(orderId)
  }
  return memoryPending.get(orderId) ?? null
}

/** Drop a finished (or abandoned) pending deposit from both indexes. */
export async function removePendingDeposit(
  orderId: string,
  ownerId: string,
): Promise<void> {
  if (kvConfigured()) {
    await kv.del(pendingKey(orderId))
  } else if (useFileStore()) {
    await fileRemovePending(orderId, ownerId)
  } else {
    memoryPending.delete(orderId)
  }
  const list = await listOwnerPendingOrderIds(ownerId)
  await writeOwnerPendingList(
    ownerId,
    list.filter((id) => id !== orderId),
  )
}

/** Upsert a pending row without duplicating the owner index merge logic. */
export async function upsertPendingDeposit(pending: PendingDeposit): Promise<void> {
  if (kvConfigured()) {
    await kv.set(pendingKey(pending.orderId), pending, { ex: 60 * 60 * 24 * 7 })
  } else if (useFileStore()) {
    await fileSavePending(pending)
  } else {
    memoryPending.set(pending.orderId, pending)
  }
  await addToOwnerPending(pending.ownerId, pending.orderId)
}

