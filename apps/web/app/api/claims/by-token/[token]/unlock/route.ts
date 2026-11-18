/**
 * POST /api/claims/by-token/[token]/unlock
 * Compares accessCode to the stored claim without leaking secrets.
 */

import { NextResponse } from "next/server"
import { getStoredClaim } from "@/lib/server/claim-store"
import { verifyAccessCode } from "@/lib/server/access-code"
import { clientIp, hit } from "@/lib/server/rate-limit"

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

  // Brute-force guard: per claim and per client IP.
  const [perClaim, perIp] = await Promise.all([
    hit(`unlock:${claim.token}`, 10, 900),
    hit(`unlock-ip:${clientIp(req)}:${claim.token}`, 8, 900),
  ])
  if (!perClaim.ok || !perIp.ok) {
    return NextResponse.json(
      { error: "too_many_attempts", message: "Too many attempts. Try again later." },
      { status: 429 },
    )
  }

  if (!verifyAccessCode(claim.accessCode, body.accessCode)) {
    return NextResponse.json(
      { error: "invalid_code", message: "That code doesn't match." },
      { status: 401 },
    )
  }

  return NextResponse.json({ ok: true })
}
