/**
 * Public API — get a claim by token or clm_{token}.
 *
 * GET /api/v1/claims/[id]
 * Authorization: Bearer sk_…
 */

import { NextResponse } from "next/server"
import { requireBearerOwner } from "@/lib/server/api-auth"
import { getStoredClaim } from "@/lib/server/claim-store"
import { serializeClaimForApi } from "@/lib/server/create-claim-for-owner"
import { reconcileClaimPayout } from "@/lib/server/reconcile-claim"

export const dynamic = "force-dynamic"

function normalizeId(id: string): string {
  const raw = decodeURIComponent(id).trim()
  if (raw.toLowerCase().startsWith("clm_")) return raw.slice(4).toUpperCase()
  return raw.toUpperCase()
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const who = await requireBearerOwner(req)
  if (!who.ok) {
    return NextResponse.json(
      { error: "unauthorized", message: "Valid Bearer API key required" },
      { status: 401 },
    )
  }

  const { id } = await ctx.params
  const token = normalizeId(id)
  let claim = await getStoredClaim(token)
  if (!claim) {
    return NextResponse.json(
      { error: "not_found", message: "Claim not found" },
      { status: 404 },
    )
  }

  if (claim.ownerId !== who.ownerId) {
    return NextResponse.json(
      { error: "not_found", message: "Claim not found" },
      { status: 404 },
    )
  }

  if (claim.status === "cashing_out" && claim.payoutOrderId) {
    claim = await reconcileClaimPayout(claim)
  }

  return NextResponse.json(serializeClaimForApi(claim))
}
