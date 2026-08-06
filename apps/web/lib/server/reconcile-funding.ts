/**
 * Reconcile pending on-ramp deposits against Etherfuse.
 * Survives page navigation, dev restarts (file store), and lost pending rows
 * by syncing completed org on-ramps from GET /ramp/orders.
 */

import "server-only"

import {
  creditDeposit,
  getLedger,
  getPendingDeposit,
  isDepositCreditedGlobally,
  listOwnerPendingOrderIds,
  removePendingDeposit,
  backfillOwnerPendingList,
  upsertPendingDeposit,
  type PendingDeposit,
} from "@/lib/server/balance-store"
import { getOrder, listOrders, type RampOrderListItem } from "@/lib/server/etherfuse"

export type ReconciledPending = PendingDeposit & {
  status: string
}

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "").toLowerCase() || "pending"
}

function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

function usdcFromOrder(order: RampOrderListItem | { amountInTokens?: unknown }): number {
  const raw = order.amountInTokens
  if (raw == null || raw === "") return 0
  return roundUsdc(Number(raw))
}

function fiatCurrency(raw: unknown): "MXN" | "BRL" {
  const c = String(raw ?? "MXN").toUpperCase()
  return c === "BRL" ? "BRL" : "MXN"
}

function isOnrampOrder(order: RampOrderListItem): boolean {
  const type = String(order.orderType ?? "").toLowerCase()
  if (type.includes("onramp") || type.includes("on_ramp")) return true
  const src = String(order.sourceAsset ?? "").toUpperCase()
  return src === "MXN" || src === "BRL"
}

/**
 * Pull org on-ramps from Etherfuse and recover rows lost when pending storage
 * was in-memory only. Completed orders credit the active owner once (demo org).
 */
export async function syncProviderOnrampsForOwner(ownerId: string): Promise<void> {
  let orders: RampOrderListItem[] = []
  try {
    orders = await listOrders({ pageSize: 50 })
  } catch (err) {
    console.error(
      "[reconcile-funding] listOrders failed:",
      err instanceof Error ? err.message : err,
    )
    return
  }

  const ledger = await getLedger(ownerId)
  const creditedHere = new Set(
    ledger.filter((e) => e.type === "deposit").map((e) => e.ref),
  )

  for (const order of orders) {
    if (!isOnrampOrder(order)) continue
    const orderId = order.orderId
    if (!orderId || creditedHere.has(orderId)) continue

    const status = normalizeStatus(order.status)
    const usdcAmount = usdcFromOrder(order)
    const existing = await getPendingDeposit(orderId)
    const globallyCredited = await isDepositCreditedGlobally(orderId)
    if (globallyCredited) continue

    if (status === "completed") {
      const amount = usdcAmount || existing?.usdcAmount || 0
      if (amount <= 0) continue
      if (!existing) {
        await upsertPendingDeposit({
          orderId,
          ownerId,
          currency: fiatCurrency(order.sourceAsset),
          fiatAmount: Number(order.amountInFiat ?? 0) || 0,
          usdcAmount: amount,
          createdAt: order.createdAt ?? new Date().toISOString(),
          credited: false,
        })
      } else if (existing.ownerId !== ownerId) {
        continue
      }
      await creditDeposit(ownerId, amount, orderId)
      await removePendingDeposit(orderId, ownerId)
      creditedHere.add(orderId)
      continue
    }

    if (status === "failed" || status === "cancelled") {
      if (existing?.ownerId === ownerId) {
        await removePendingDeposit(orderId, ownerId)
      }
      continue
    }

    if (existing?.ownerId !== ownerId) continue

    if (usdcAmount > 0 && existing && existing.usdcAmount !== usdcAmount) {
      await upsertPendingDeposit({ ...existing, usdcAmount })
    }
  }
}

export async function reconcileOneDeposit(
  orderId: string,
  ownerId: string,
): Promise<ReconciledPending | null> {
  const pending = await getPendingDeposit(orderId)
  if (!pending || pending.ownerId !== ownerId) {
    return null
  }

  try {
    const order = await getOrder(orderId)
    const status = normalizeStatus(order.status)
    const delivered =
      usdcFromOrder(order as RampOrderListItem) || pending.usdcAmount

    if (status === "completed") {
      await creditDeposit(ownerId, delivered, orderId)
      await removePendingDeposit(orderId, ownerId)
      return {
        ...pending,
        usdcAmount: delivered,
        credited: true,
        status: "completed",
      }
    }

    if (status === "failed" || status === "cancelled") {
      await removePendingDeposit(orderId, ownerId)
      return { ...pending, status }
    }

    return { ...pending, status: status || "pending" }
  } catch (err) {
    console.error(
      `[reconcile-funding] order ${orderId}:`,
      err instanceof Error ? err.message : err,
    )
    return {
      ...pending,
      status: pending.credited ? "completed" : "pending",
    }
  }
}

export async function reconcilePendingDeposits(
  ownerId: string,
): Promise<ReconciledPending[]> {
  await syncProviderOnrampsForOwner(ownerId)
  await backfillOwnerPendingList(ownerId)
  const orderIds = await listOwnerPendingOrderIds(ownerId)
  const out: ReconciledPending[] = []

  for (const orderId of orderIds) {
    const row = await reconcileOneDeposit(orderId, ownerId)
    if (!row) {
      await removePendingDeposit(orderId, ownerId)
      continue
    }
    if (
      row.status !== "completed" &&
      row.status !== "failed" &&
      row.status !== "cancelled"
    ) {
      out.push(row)
    }
  }

  return out
}
