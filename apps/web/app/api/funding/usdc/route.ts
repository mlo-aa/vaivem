/**
 * GET /api/funding/usdc — deposit address + per-sender memo for crypto funding.
 */

import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { ownerDepositMemoHex } from "@/lib/server/deposit-memo"
import {
  ETHERFUSE_USDC_ISSUER,
  getEtherfuseUsdcCodeIssuer,
  getSponsorPublicKey,
  HORIZON_URL,
} from "@/lib/server/stellar"

export const dynamic = "force-dynamic"

export async function GET() {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { code, issuer } = getEtherfuseUsdcCodeIssuer()
    return NextResponse.json({
      address: getSponsorPublicKey(),
      memo: ownerDepositMemoHex(who.ownerId),
      memoType: "hash",
      assetCode: code,
      assetIssuer: issuer || ETHERFUSE_USDC_ISSUER,
      network: "testnet",
      horizonUrl: HORIZON_URL,
      note:
        "Only USDC issued by this issuer is credited. Other USDC assets are ignored. Use Memo type Hash with the hex value below.",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
