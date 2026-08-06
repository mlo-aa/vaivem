/**
 * GET  /api/claims/by-token/[token]  — PUBLIC (no secrets).
 * PATCH /api/claims/by-token/[token] — reconcile (public) + owner cancel/refund/extend.
 */

import { NextResponse } from "next/server"
import { refundExpiredBalance, StellarError } from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"
import {
  getStoredClaim,
  toPublicClaim,
  updateStoredClaim,
} from "@/lib/server/claim-store"
import { reconcileClaimPayout } from "@/lib/server/reconcile-claim"
import { optionalOwnerId } from "@/lib/server/auth-session"
import { creditRefund } from "@/lib/server/balance-store"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 })
  }

  let claim = await getStoredClaim(token)
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }

  if (claim.status === "cashing_out" && claim.payoutOrderId) {
    claim = await reconcileClaimPayout(claim)
  }

  return NextResponse.json(toPublicClaim(claim))
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params
  const claim = await getStoredClaim(token)
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }

  let body: { action?: string; days?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = body.action
  try {
    if (action === "reconcile") {
      const updated = await reconcileClaimPayout(claim)
      return NextResponse.json({ claim: updated })
    }

    const ownerId = await optionalOwnerId()
    if (!ownerId || claim.ownerId !== ownerId) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    if (action === "cancel" || action === "refund") {
      try {
        const { hash } = await refundExpiredBalance(claim.balanceId)
        await recipientSecretsByBalanceId.delete(claim.balanceId)
        const updated = await updateStoredClaim(token, {
          status: action === "cancel" ? "cancelled" : "refunded",
          txHash: hash,
        })
        if (claim.ownerId && claim.amount > 0) {
          try {
            await creditRefund(claim.ownerId, claim.amount, claim.token)
          } catch (ledgerErr) {
            console.error("[claims/patch] ledger refund failed:", ledgerErr)
          }
        }
        return NextResponse.json({ claim: updated })
      } catch (err) {
        if (err instanceof StellarError) {
          const ops = err.resultCodes?.operations ?? []
          if (
            ops.includes("op_cannot_claim") ||
            err.message.includes("op_cannot_claim")
          ) {
            return NextResponse.json(
              {
                error: "claim_window_open",
                message:
                  "Claim window is still open — refund is not available until the deadline.",
              },
              { status: 409 },
            )
          }
        }
        throw err
      }
    }

    if (action === "extend") {
      const days = Number(body.days ?? 7)
      const newDeadline = claim.deadline + Math.floor(days * 86400)
      const updated = await updateStoredClaim(token, {
        deadline: newDeadline,
        expiresAt: new Date(newDeadline * 1000).toISOString(),
      })
      return NextResponse.json({ claim: updated })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    console.error("[claims/patch] failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
