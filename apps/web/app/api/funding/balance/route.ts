/**
 * GET /api/funding/balance — reconcile pending on-ramps, then return demo ledger.
 */

import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { getBalance, getLedger } from "@/lib/server/balance-store"
import { reconcilePendingDeposits } from "@/lib/server/reconcile-funding"

export const dynamic = "force-dynamic"

export async function GET() {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pending = await reconcilePendingDeposits(who.ownerId)

  const [balance, ledger] = await Promise.all([
    getBalance(who.ownerId),
    getLedger(who.ownerId),
  ])

  return NextResponse.json({
    ownerId: who.ownerId,
    amount: balance.amount,
    updatedAt: balance.updatedAt,
    ledger,
    pending: pending.map((p) => ({
      orderId: p.orderId,
      status: p.status,
      currency: p.currency,
      fiatAmount: p.fiatAmount,
      usdcAmount: p.usdcAmount,
      createdAt: p.createdAt,
      credited: p.credited,
    })),
  })
}
