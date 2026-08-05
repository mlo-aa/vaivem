/**
 * GET /api/claims/[balanceId]
 *
 * Claimable balance state from Horizon, or 404 if already claimed/refunded.
 */

import { NextResponse } from "next/server"
import { Horizon } from "@stellar/stellar-sdk"
import { StellarError } from "@/lib/server/stellar"

export const dynamic = "force-dynamic"

const HORIZON_URL = "https://horizon-testnet.stellar.org"

/** Horizon returns this; the SDK's ClaimableBalanceRecord omits it. */
type ClaimableBalanceWithTime = Horizon.ServerApi.ClaimableBalanceRecord & {
  last_modified_time?: string
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ balanceId: string }> },
) {
  const { balanceId } = await ctx.params
  if (!balanceId) {
    return NextResponse.json({ error: "balanceId requerido" }, { status: 400 })
  }

  try {
    const server = new Horizon.Server(HORIZON_URL)
    const cb = (await server
      .claimableBalances()
      .claimableBalance(balanceId)
      .call()) as ClaimableBalanceWithTime

    return NextResponse.json({
      id: cb.id,
      asset: cb.asset,
      amount: cb.amount,
      sponsor: cb.sponsor ?? null,
      claimants: cb.claimants,
      lastModifiedLedger: cb.last_modified_ledger,
      lastModifiedTime: cb.last_modified_time ?? null,
    })
  } catch (err) {
    const status =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined

    if (status === 404) {
      return NextResponse.json(
        { error: "Claimable balance not found (already claimed or refunded)" },
        { status: 404 },
      )
    }

    const message =
      err instanceof StellarError ? err.message : "error desconocido"
    console.error("[claims/get] falló:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
