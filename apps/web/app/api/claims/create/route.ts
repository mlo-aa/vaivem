/**
 * POST /api/claims/create
 *
 * Checks the sender's demo ledger, funds a claimable balance for the real USDC
 * amount from the shared sponsor wallet, debits the ledger, stores the claim.
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
import { isBelowMinimum, minAmountMessage, MIN_AMOUNT_USDC } from "@/lib/limits"
import { requireOwnerId } from "@/lib/server/auth-session"
import { debitForClaim, getBalance } from "@/lib/server/balance-store"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const amount = Number(body.amount)
    const country = String(body.country ?? "BR")
    // Never trust client-supplied senderName for branding — use the session.
    const senderName = who.name?.trim() || who.email || "Vaivém sender"
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
    const batchId =
      body.batchId != null && String(body.batchId).trim()
        ? String(body.batchId).trim().slice(0, 64)
        : null
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

    const balance = await getBalance(who.ownerId)
    if (balance.amount + 1e-9 < amount) {
      return NextResponse.json(
        {
          error: "insufficient_balance",
          message: `Insufficient balance. You have ${balance.amount.toFixed(2)} USDC and need ${amount.toFixed(2)} USDC. Add funds on the Funding page.`,
          available: balance.amount,
          required: amount,
        },
        { status: 402 },
      )
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
    try {
      await debitForClaim(who.ownerId, amount, token)
    } catch (err) {
      if (err instanceof Error && err.message === "insufficient_balance") {
        return NextResponse.json(
          {
            error: "insufficient_balance",
            message:
              "Insufficient balance. Add funds on the Funding page before creating a claim.",
          },
          { status: 402 },
        )
      }
      throw err
    }

    const now = new Date().toISOString()
    const record: StoredClaim = {
      token,
      ownerId: who.ownerId,
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
      batchId,
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
      ownerId: who.ownerId,
      senderName,
      batchId,
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
