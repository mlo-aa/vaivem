/**
 * GET /api/funding/[orderId]
 * Poll Etherfuse on-ramp; credit the sender ledger when the order completes.
 */

import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import {
  creditDeposit,
  getPendingDeposit,
  markPendingCredited,
} from "@/lib/server/balance-store"
import { EtherfuseError, getOrder } from "@/lib/server/etherfuse"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orderId } = await ctx.params
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 })
  }

  const pending = await getPendingDeposit(orderId)
  if (!pending) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
  }
  if (pending.ownerId !== who.ownerId) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
  }

  try {
    const order = await getOrder(orderId)
    const status = String(order.status ?? "").toLowerCase()

    if (status === "completed" && !pending.credited) {
      await creditDeposit(pending.ownerId, pending.usdcAmount, orderId)
      await markPendingCredited(orderId)
      return NextResponse.json({
        orderId,
        status: "completed",
        credited: true,
        usdcAmount: pending.usdcAmount,
        currency: pending.currency,
        fiatAmount: pending.fiatAmount,
      })
    }

    if (status === "completed" && pending.credited) {
      return NextResponse.json({
        orderId,
        status: "completed",
        credited: true,
        usdcAmount: pending.usdcAmount,
        currency: pending.currency,
        fiatAmount: pending.fiatAmount,
      })
    }

    if (status === "failed" || status === "cancelled") {
      return NextResponse.json({
        orderId,
        status,
        credited: false,
        usdcAmount: pending.usdcAmount,
        currency: pending.currency,
        fiatAmount: pending.fiatAmount,
      })
    }

    return NextResponse.json({
      orderId,
      status: status || "pending",
      credited: false,
      usdcAmount: pending.usdcAmount,
      currency: pending.currency,
      fiatAmount: pending.fiatAmount,
    })
  } catch (err) {
    const message =
      err instanceof EtherfuseError ? err.message : err instanceof Error ? err.message : "error"
    console.error("[funding/poll]", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
