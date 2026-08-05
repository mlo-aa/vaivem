/**
 * POST /api/claims/fund
 *
 * Generates a recipient keypair, creates a sponsored account + claimable
 * balance. The recipient secret never leaves the server.
 */

import { NextResponse } from "next/server"
import {
  createClaimableBalance,
  createSponsoredAccount,
  generateRecipientKeypair,
  StellarError,
} from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"

export const dynamic = "force-dynamic"

const DEFAULT_EXPIRES_IN_SECONDS = 300

export async function POST(req: Request) {
  let amount: string
  let expiresInSeconds: number

  try {
    const body = await req.json()
    amount = String(body.amount ?? "")
    expiresInSeconds =
      body.expiresInSeconds != null
        ? Number(body.expiresInSeconds)
        : DEFAULT_EXPIRES_IN_SECONDS
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const amountNum = Number(amount)
  if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: "amount debe ser un número positivo" },
      { status: 400 },
    )
  }
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return NextResponse.json(
      { error: "expiresInSeconds debe ser un número positivo" },
      { status: 400 },
    )
  }

  try {
    const recipient = generateRecipientKeypair()
    await createSponsoredAccount(recipient.publicKey, recipient.secret)

    const { balanceId, hash, deadline } = await createClaimableBalance(
      recipient.publicKey,
      amount,
      expiresInSeconds,
    )

    // TODO(persistence): durable encrypted store keyed by balanceId
    recipientSecretsByBalanceId.set(balanceId, recipient.secret)

    return NextResponse.json({
      balanceId,
      recipientPublicKey: recipient.publicKey,
      deadline,
      hash,
    })
  } catch (err) {
    const message =
      err instanceof StellarError ? err.message : "error desconocido"
    console.error("[claims/fund] falló:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
