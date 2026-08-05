/**
 * POST /api/claims/create
 *
 * Funds a claimable balance for the real USDC amount, stores the claim record,
 * returns { token, url, deadline }.
 */

import { NextResponse } from "next/server"
import {
  createClaimableBalance,
  createSponsoredAccount,
  generateRecipientKeypair,
  StellarError,
} from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"
import {
  generateClaimToken,
  saveStoredClaim,
  type StoredClaim,
} from "@/lib/server/claim-store"
import type { ProtectionType } from "@/lib/types"
import { currentOrg } from "@/lib/mock-data"
import { isBelowMinimum, minAmountMessage, MIN_AMOUNT_USDC } from "@/lib/limits"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const amount = Number(body.amount)
    const country = String(body.country ?? "BR")
    const senderName = String(body.senderName ?? currentOrg.name)
    const recipientName = String(body.recipientName ?? "")
    const recipientEmail =
      body.recipientEmail != null ? String(body.recipientEmail) : null
    const message = body.message != null ? String(body.message) : null
    const protectionType = (body.protectionType ?? "public") as ProtectionType
    const accessCode =
      protectionType === "code" && body.accessCode
        ? String(body.accessCode)
        : null
    const expirationDays = Number(body.expirationDays ?? 7)
    const displayCurrency = body.displayCurrency === "USD" ? "USD" : "BRL"
    const displayAmount = Number(body.displayAmount ?? amount)
    const purpose = String(body.purpose ?? "Payout")
    const reference = body.reference != null ? String(body.reference) : null
    const allowPix = body.allowPix !== false
    const allowStellar = body.allowStellar !== false

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number (USDC)" },
        { status: 400 },
      )
    }
    if (!allowPix && !allowStellar) {
      return NextResponse.json(
        { error: "at least one payout rail must be allowed" },
        { status: 400 },
      )
    }
    // Only the PIX rail goes through Etherfuse. A Stellar-only claim can be any amount.
    if (allowPix && isBelowMinimum(amount)) {
      return NextResponse.json(
        {
          error: "amount_below_minimum",
          message: minAmountMessage(displayCurrency),
          minAmountUsdc: MIN_AMOUNT_USDC,
        },
        { status: 422 },
      )
    }
    if (recipientName.trim().length < 2) {
      return NextResponse.json({ error: "recipientName required" }, { status: 400 })
    }
    if (protectionType === "code" && (!accessCode || accessCode.length < 4)) {
      return NextResponse.json(
        { error: "accessCode required for code protection" },
        { status: 400 },
      )
    }
    if (!Number.isFinite(expirationDays) || expirationDays <= 0) {
      return NextResponse.json({ error: "expirationDays invalid" }, { status: 400 })
    }

    const expiresInSeconds = Math.floor(expirationDays * 86400)
    const amountStr = amount.toFixed(2)

    const recipient = generateRecipientKeypair()
    await createSponsoredAccount(recipient.publicKey, recipient.secret)

    const { balanceId, hash, deadline } = await createClaimableBalance(
      recipient.publicKey,
      amountStr,
      expiresInSeconds,
    )

    await recipientSecretsByBalanceId.set(balanceId, recipient.secret, deadline)

    const token = generateClaimToken()
    const now = new Date().toISOString()
    const record: StoredClaim = {
      token,
      balanceId,
      recipientPublicKey: recipient.publicKey,
      amount,
      country,
      senderName,
      recipientName,
      recipientEmail,
      message,
      protectionType,
      accessCode,
      status: "shared",
      deadline,
      createdAt: now,
      claimedAt: null,
      payoutMethod: null,
      payoutOrderId: null,
      txHash: hash,
      displayCurrency,
      displayAmount,
      purpose,
      reference,
      expiresAt: new Date(deadline * 1000).toISOString(),
    }
    await saveStoredClaim(record)

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    return NextResponse.json({
      token,
      url: `${appUrl.replace(/\/$/, "")}/claim/${token}`,
      deadline,
      balanceId,
      hash,
      amount,
    })
  } catch (err) {
    const message =
      err instanceof StellarError
        ? err.message
        : err instanceof Error
          ? err.message
          : "error desconocido"
    console.error("[claims/create] falló:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
