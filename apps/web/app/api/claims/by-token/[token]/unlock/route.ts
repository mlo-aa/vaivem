/**
 * POST /api/claims/by-token/[token]/unlock
 * Compares accessCode to the stored claim without leaking secrets.
 */

import { NextResponse } from "next/server"
import { getStoredClaim } from "@/lib/server/claim-store"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params
  const claim = await getStoredClaim(token)
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }

  if (claim.protectionType !== "code") {
    return NextResponse.json({ ok: true })
  }

  let body: { accessCode?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.accessCode || body.accessCode !== claim.accessCode) {
    return NextResponse.json(
      { error: "invalid_code", message: "That code doesn't match." },
      { status: 401 },
    )
  }

  return NextResponse.json({ ok: true })
}
