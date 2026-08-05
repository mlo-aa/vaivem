/**
 * POST /api/claims/[balanceId]/claim
 *
 * Looks up the recipient secret and claims via fee-bump (recipient has 0 XLM).
 */

import { NextResponse } from "next/server"
import { claimBalance, StellarError } from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"

export const dynamic = "force-dynamic"

const EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx"

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ balanceId: string }> },
) {
  const { balanceId } = await ctx.params
  if (!balanceId) {
    return NextResponse.json({ error: "balanceId requerido" }, { status: 400 })
  }

  const recipientSecret = await recipientSecretsByBalanceId.get(balanceId)
  if (!recipientSecret) {
    return NextResponse.json(
      { error: "Unknown balanceId (secret not found on this server)" },
      { status: 404 },
    )
  }

  try {
    const { hash } = await claimBalance(balanceId, recipientSecret)
    await recipientSecretsByBalanceId.delete(balanceId)
    return NextResponse.json({
      hash,
      explorerUrl: `${EXPLORER_TX}/${hash}`,
    })
  } catch (err) {
    const message =
      err instanceof StellarError ? err.message : "error desconocido"
    console.error("[claims/claim] falló:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
