import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { getPendingDeposit } from "@/lib/server/balance-store"
import { EtherfuseError } from "@/lib/server/etherfuse"
import { reconcileOneDeposit, syncProviderOnrampsForOwner } from "@/lib/server/reconcile-funding"

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
  if (!pending || pending.ownerId !== who.ownerId) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
  }

  try {
    await syncProviderOnrampsForOwner(who.ownerId)
    const row = await reconcileOneDeposit(orderId, who.ownerId)
    if (!row) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
    }
    return NextResponse.json({
      orderId: row.orderId,
      status: row.status,
      credited: row.credited || row.status === "completed",
      usdcAmount: row.usdcAmount,
      currency: row.currency,
      fiatAmount: row.fiatAmount,
    })
  } catch (err) {
    const message =
      err instanceof EtherfuseError
        ? err.message
        : err instanceof Error
          ? err.message
          : "error"
    console.error("[funding/poll]", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
