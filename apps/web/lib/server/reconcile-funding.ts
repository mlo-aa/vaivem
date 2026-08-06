/**
 * Reconcile pending on-ramp deposits against live Etherfuse order status.
 * Called from GET /api/funding/balance so credits survive navigation away.
 */

import "server-only"

import { getOrder } from "@/lib/server/etherfuse"
import {
  creditDeposit,
  getPendingDeposit,
  listOwnerPendingOrderIds,
  removePendingDeposit,
  backfillOwnerPendingList,
  type PendingDeposit,
} from "@/lib/server/balance-store"

export type ReconciledPending = PendingDeposit & {
  status: string
}

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "").toLowerCase() || "pending"
}

/**
 * For one pending order: credit ledger if Etherfuse says completed, drop
 * terminal states from the owner pending list. Returns the current view.
 */
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

    if (status === "completed") {
      if (!pending.credited) {
        await creditDeposit(pending.ownerId, pending.usdcAmount, orderId)
      }
      await removePendingDeposit(orderId, ownerId)
      return {
        ...pending,
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

/**
 * Reconcile every pending deposit for this owner. Already-completed Etherfuse
 * orders are credited even if nobody polled while they finished.
 */
export async function reconcilePendingDeposits(
  ownerId: string,
): Promise<ReconciledPending[]> {
  await backfillOwnerPendingList(ownerId)
  const orderIds = await listOwnerPendingOrderIds(ownerId)
  const out: ReconciledPending[] = []

  for (const orderId of orderIds) {
    const row = await reconcileOneDeposit(orderId, ownerId)
    if (!row) {
      // List entry without a deposit record — drop the orphan.
      await removePendingDeposit(orderId, ownerId)
      continue
    }
    if (row.status !== "completed" && row.status !== "failed" && row.status !== "cancelled") {
      out.push(row)
    }
  }

  return out
}
