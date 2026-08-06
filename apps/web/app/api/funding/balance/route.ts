/**
 * GET /api/funding/balance — reconcile on-ramps + USDC deposits, then return demo ledger.
 */

import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { getBalance, getLedger } from "@/lib/server/balance-store"
import { reconcilePendingDeposits } from "@/lib/server/reconcile-funding"
import { reconcileUsdcDeposits } from "@/lib/server/reconcile-usdc-deposits"

export const dynamic = "force-dynamic"

export async function GET() {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [pending, usdcCredits] = await Promise.all([
    reconcilePendingDeposits(who.ownerId),
    reconcileUsdcDeposits(who.ownerId),
  ])

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
    usdcCredits: usdcCredits.map((c) => ({
      txHash: c.txHash,
      amount: c.amount,
    })),
  })
}
