/**
 * File-backed fallback when KV is not configured (local dev).
 * Persists balances, ledgers, and pending deposits across dev server restarts.
 */

import "server-only"

import fs from "node:fs/promises"
import path from "node:path"

type LedgerEntry = {
  id: string
  type: "deposit" | "deposit_usdc" | "claim_funded" | "refund"
  amount: number
  ref: string
  createdAt: string
}

type SenderBalance = {
  ownerId: string
  amount: number
  updatedAt: string
}

type PendingDeposit = {
  orderId: string
  ownerId: string
  currency: "MXN" | "BRL"
  fiatAmount: number
  usdcAmount: number
  createdAt: string
  credited: boolean
}

type FileStoreSnapshot = {
  balances: Record<string, SenderBalance>
  ledgers: Record<string, LedgerEntry[]>
  pending: Record<string, PendingDeposit>
  ownerPending: Record<string, string[]>
  creditedOrders: Record<string, true>
}

const DATA_DIR = path.join(process.cwd(), ".data")
const STORE_PATH = path.join(DATA_DIR, "funding-store.json")

let snapshot: FileStoreSnapshot | null = null
let writeChain: Promise<void> = Promise.resolve()

function emptySnapshot(): FileStoreSnapshot {
  return {
    balances: {},
    ledgers: {},
    pending: {},
    ownerPending: {},
    creditedOrders: {},
  }
}

async function loadSnapshot(): Promise<FileStoreSnapshot> {
  if (snapshot) return snapshot
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<FileStoreSnapshot>
    snapshot = {
      balances: parsed.balances ?? {},
      ledgers: parsed.ledgers ?? {},
      pending: parsed.pending ?? {},
      ownerPending: parsed.ownerPending ?? {},
      creditedOrders: parsed.creditedOrders ?? {},
    }
  } catch {
    snapshot = emptySnapshot()
  }
  return snapshot
}

async function persistSnapshot(next: FileStoreSnapshot): Promise<void> {
  snapshot = next
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8")
  })
  await writeChain
}

export async function fileGetBalance(ownerId: string): Promise<SenderBalance | null> {
  const s = await loadSnapshot()
  return s.balances[ownerId] ?? null
}

export async function fileGetLedger(ownerId: string): Promise<LedgerEntry[]> {
  const s = await loadSnapshot()
  return s.ledgers[ownerId] ?? []
}

export async function fileWriteBalance(balance: SenderBalance): Promise<void> {
  const s = await loadSnapshot()
  s.balances[balance.ownerId] = balance
  await persistSnapshot(s)
}

export async function fileWriteLedger(
  ownerId: string,
  entries: LedgerEntry[],
): Promise<void> {
  const s = await loadSnapshot()
  s.ledgers[ownerId] = entries
  await persistSnapshot(s)
}

export async function fileGetPending(orderId: string): Promise<PendingDeposit | null> {
  const s = await loadSnapshot()
  return s.pending[orderId] ?? null
}

export async function fileSavePending(pending: PendingDeposit): Promise<void> {
  const s = await loadSnapshot()
  s.pending[pending.orderId] = pending
  const list = s.ownerPending[pending.ownerId] ?? []
  if (!list.includes(pending.orderId)) {
    s.ownerPending[pending.ownerId] = [...list, pending.orderId]
  }
  await persistSnapshot(s)
}

export async function fileRemovePending(
  orderId: string,
  ownerId: string,
): Promise<void> {
  const s = await loadSnapshot()
  delete s.pending[orderId]
  const list = s.ownerPending[ownerId] ?? []
  s.ownerPending[ownerId] = list.filter((id) => id !== orderId)
  if (s.ownerPending[ownerId]?.length === 0) delete s.ownerPending[ownerId]
  await persistSnapshot(s)
}

export async function fileListOwnerPending(ownerId: string): Promise<string[]> {
  const s = await loadSnapshot()
  return s.ownerPending[ownerId] ?? []
}

export async function fileBackfillOwnerPending(ownerId: string): Promise<void> {
  const s = await loadSnapshot()
  const found: string[] = []
  for (const [orderId, row] of Object.entries(s.pending)) {
    if (row.ownerId === ownerId && !row.credited) found.push(orderId)
  }
  if (found.length === 0) return
  const existing = s.ownerPending[ownerId] ?? []
  const merged = [...new Set([...existing, ...found])]
  if (merged.length === existing.length) return
  s.ownerPending[ownerId] = merged
  await persistSnapshot(s)
}

export async function fileScanPendingForOwner(
  ownerId: string,
): Promise<PendingDeposit[]> {
  const s = await loadSnapshot()
  return Object.values(s.pending).filter((p) => p.ownerId === ownerId)
}

export async function fileSetOwnerPendingList(
  ownerId: string,
  orderIds: string[],
): Promise<void> {
  const s = await loadSnapshot()
  const unique = [...new Set(orderIds)]
  if (unique.length === 0) {
    delete s.ownerPending[ownerId]
  } else {
    s.ownerPending[ownerId] = unique
  }
  await persistSnapshot(s)
}

export async function fileHasDepositRef(orderId: string): Promise<boolean> {
  const s = await loadSnapshot()
  if (s.creditedOrders[orderId]) return true
  for (const entries of Object.values(s.ledgers)) {
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
  return false
}

export async function fileMarkDepositCredited(orderId: string): Promise<void> {
  const s = await loadSnapshot()
  s.creditedOrders[orderId] = true
  await persistSnapshot(s)
}
