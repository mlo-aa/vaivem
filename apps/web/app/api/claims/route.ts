/**
 * GET /api/claims
 * Dashboard list — only the caller's claims. Reconciles cashing_out rows.
 */

import { NextResponse } from "next/server"
import { listStoredClaimsByOwner } from "@/lib/server/claim-store"
import { reconcileClaimPayout } from "@/lib/server/reconcile-claim"
import { requireOwnerId } from "@/lib/server/auth-session"

export const dynamic = "force-dynamic"

function serialize(c: Awaited<ReturnType<typeof listStoredClaimsByOwner>>[number]) {
  return {
    token: c.token,
    ownerId: c.ownerId,
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
  }
}

export async function GET() {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const claims = await listStoredClaimsByOwner(who.ownerId)
    const reconciled = await Promise.all(
      claims.map(async (c) => {
        if (c.status === "cashing_out" && c.payoutOrderId) {
          return reconcileClaimPayout(c)
        }
        return c
      }),
    )
    return NextResponse.json({ claims: reconciled.map(serialize) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido"
    console.error("[claims/list] falló:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
