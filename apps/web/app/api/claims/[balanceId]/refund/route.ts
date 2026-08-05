/**
 * POST /api/claims/[balanceId]/refund
 *
 * Sponsor reclaim after expiry. op_cannot_claim → 409 (window still open).
 */

import { NextResponse } from "next/server"
import { refundExpiredBalance, StellarError } from "@/lib/server/stellar"
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

  try {
    const { hash } = await refundExpiredBalance(balanceId)
    await recipientSecretsByBalanceId.delete(balanceId)
    return NextResponse.json({
      hash,
      explorerUrl: `${EXPLORER_TX}/${hash}`,
    })
  } catch (err) {
    if (err instanceof StellarError) {
      const ops = err.resultCodes?.operations ?? []
      if (
        ops.includes("op_cannot_claim") ||
        err.message.includes("op_cannot_claim")
      ) {
        return NextResponse.json(
          { error: "Claim window is still open — refund is not available yet" },
          { status: 409 },
        )
      }
      console.error("[claims/refund] falló:", err.message)
      return NextResponse.json({ error: err.message }, { status: 502 })
    }

    console.error("[claims/refund] falló:", "error desconocido")
    return NextResponse.json({ error: "error desconocido" }, { status: 502 })
  }
}
