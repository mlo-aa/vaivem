/**
 * GET /api/payouts/[orderId]
 *
 * Poll Etherfuse GET /ramp/order/{orderId} until status === "completed".
 */

import { NextResponse } from "next/server"
import { EtherfuseError, getOrder } from "@/lib/server/etherfuse"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params
  if (!orderId) {
    return NextResponse.json({ error: "orderId requerido" }, { status: 400 })
  }

  if (orderId.startsWith("mock_")) {
    return NextResponse.json({
      orderId,
      status: "completed",
      source: "mock" as const,
    })
  }

  try {
    const order = await getOrder(orderId)
    return NextResponse.json({
      orderId: order.orderId ?? orderId,
      status: order.status,
      source: "live" as const,
      raw: order,
    })
  } catch (err) {
    const message =
      err instanceof EtherfuseError ? err.message : "unknown error"
    console.error("[payouts/get] failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
