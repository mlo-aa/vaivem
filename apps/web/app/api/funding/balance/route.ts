/**
 * GET /api/funding/balance — current demo ledger balance + recent entries.
 */

import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { getBalance, getLedger } from "@/lib/server/balance-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [balance, ledger] = await Promise.all([
    getBalance(who.ownerId),
    getLedger(who.ownerId),
  ])

  return NextResponse.json({
    ownerId: who.ownerId,
    amount: balance.amount,
    updatedAt: balance.updatedAt,
    ledger,
  })
}
