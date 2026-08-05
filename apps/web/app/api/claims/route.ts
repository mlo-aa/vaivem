/**
 * GET /api/claims
 * Dashboard list of stored claims (no secrets).
 */

import { NextResponse } from "next/server"
import { listStoredClaims } from "@/lib/server/claim-store"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const claims = await listStoredClaims()
    return NextResponse.json({
      claims: claims.map((c) => ({
        token: c.token,
        amount: c.amount,
        displayAmount: c.displayAmount ?? c.amount,
        displayCurrency: c.displayCurrency ?? "USD",
        country: c.country,
        senderName: c.senderName,
        recipientName: c.recipientName,
        recipientEmail: c.recipientEmail,
        message: c.message,
        protectionType: c.protectionType,
        status: c.status,
        deadline: c.deadline,
        expiresAt: c.expiresAt ?? new Date(c.deadline * 1000).toISOString(),
        createdAt: c.createdAt,
        claimedAt: c.claimedAt,
        payoutMethod: c.payoutMethod,
        payoutOrderId: c.payoutOrderId,
        txHash: c.txHash,
        purpose: c.purpose ?? "Payout",
        reference: c.reference ?? null,
        balanceId: c.balanceId,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido"
    console.error("[claims/list] falló:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
