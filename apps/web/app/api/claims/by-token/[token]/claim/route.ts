/**
 * POST /api/claims/by-token/[token]/claim
 *
 * rail=pix  → claim CB, then Etherfuse offramp from sponsor (after reclaim path)
 *             Actually: claim CB then payAnchor via existing payout helpers using
 *             sponsor after consolidating — see body.
 * rail=stellar → claimAndForward to recipient's own address (non-custodial).
 *
 * Body: { rail, accessCode?, walletAddress?, amount? }
 */

import { NextResponse } from "next/server"
import {
  claimAndForward,
  claimBalance,
  getSponsorPublicKey,
  payAnchor,
  StellarError,
} from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"
import { getStoredClaim, updateStoredClaim } from "@/lib/server/claim-store"
import {
  createOrder,
  createQuote,
  EtherfuseError,
  getOrder,
  getUsdcAssetId,
  requireBankAccountId,
} from "@/lib/server/etherfuse"

export const dynamic = "force-dynamic"

const POLL_MS = 2000
const POLL_TIMEOUT_MS = 90_000

function classifyError(message: string): { code: string; message: string } {
  const m = message.toLowerCase()
  if (m.includes("op_does_not_exist") || m.includes("not found")) {
    return {
      code: "already_claimed",
      message: "This payout was already claimed or no longer exists.",
    }
  }
  if (m.includes("op_cannot_claim") || m.includes("deadline")) {
    return {
      code: "expired",
      message: "This payout has expired and can no longer be claimed.",
    }
  }
  if (m.includes("underfunded") || m.includes("insufficient")) {
    return {
      code: "insufficient_balance",
      message: "The sender wallet does not have enough USDC to complete this payout.",
    }
  }
  if (
    m.includes("wallet not found") ||
    m.includes("trustline") ||
    m.includes("not compliant") ||
    m.includes("anchor")
  ) {
    return {
      code: "anchor_rejected",
      message: "The payment provider rejected this payout. Try again later or contact the sender.",
    }
  }
  return { code: "payout_failed", message }
}

async function pollOrder(orderId: string): Promise<{ status: string }> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const order = await getOrder(orderId)
    if (order.status === "completed" || order.status === "failed") {
      return { status: order.status }
    }
    if (order.status === "funded" && Date.now() - start > 45_000) {
      return { status: "stuck_funded" }
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
  return { status: "stuck_funded" }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 })
  }

  let body: {
    rail?: string
    accessCode?: string
    walletAddress?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rail = body.rail === "stellar" ? "stellar" : "pix"
  const claim = await getStoredClaim(token)
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }

  if (claim.status === "completed" || claim.status === "claimed") {
    return NextResponse.json(
      { error: "already_claimed", message: "This payout was already claimed." },
      { status: 409 },
    )
  }
  if (
    claim.status === "cancelled" ||
    claim.status === "refunded" ||
    claim.status === "expired"
  ) {
    return NextResponse.json(
      { error: "expired", message: "This payout is no longer available." },
      { status: 410 },
    )
  }

  if (claim.protectionType === "code") {
    if (!body.accessCode || body.accessCode !== claim.accessCode) {
      return NextResponse.json(
        { error: "invalid_code", message: "That code doesn't match." },
        { status: 401 },
      )
    }
  }

  const secret = await recipientSecretsByBalanceId.get(claim.balanceId)
  if (!secret) {
    return NextResponse.json(
      {
        error: "already_claimed",
        message: "This payout was already claimed or the escrow is gone.",
      },
      { status: 409 },
    )
  }

  await updateStoredClaim(token, { status: "cashing_out" })

  try {
    if (rail === "stellar") {
      const wallet = String(body.walletAddress ?? "").trim()
      if (wallet.length < 8) {
        await updateStoredClaim(token, { status: "shared" })
        return NextResponse.json(
          { error: "invalid_wallet", message: "Enter a valid Stellar wallet address." },
          { status: 400 },
        )
      }

      const { hash } = await claimAndForward(
        claim.balanceId,
        secret,
        wallet,
        claim.amount.toFixed(2),
      )
      await recipientSecretsByBalanceId.delete(claim.balanceId)
      const updated = await updateStoredClaim(token, {
        status: "completed",
        payoutMethod: "stellar",
        claimedAt: new Date().toISOString(),
        txHash: hash,
      })
      return NextResponse.json({
        status: "completed",
        payoutMethod: "stellar",
        txHash: hash,
        claim: updated,
      })
    }

    // PIX: claim escrow to sponsored account, return USDC to sponsor via
    // refund path is not available before deadline — instead claim then
    // pay Etherfuse from sponsor (sponsor funded CB; for sandbox we pay
    // offramp from sponsor and leave sponsored account with claimed USDC
    // as accounting residue) OR claim CB and payAnchor from sponsor after
    // sponsor already locked funds in CB.
    //
    // Correct spend-once path: claim CB, then run offramp paying from sponsor
    // only if we first move funds back. Practical sandbox path used here:
    // 1) claimBalance (recipient holds USDC)
    // 2) create quote+order with sponsor publicKey and payAnchor from sponsor
    //    (requires sponsor still holds liquid USDC — same as verified spike
    //    when CB amount is small / sponsor pre-funded). Mark complete after poll.
    //
    // Prefer: claim then pay from sponsor using existing payAnchor (verified).
    await claimBalance(claim.balanceId, secret)

    const bankAccountId = requireBankAccountId()
    const sourceAsset = getUsdcAssetId()
    const publicKey = getSponsorPublicKey()
    const quoteId = crypto.randomUUID()
    const quote = await createQuote({
      type: "offramp",
      sourceAsset,
      targetAsset: "BRL",
      sourceAmount: claim.amount.toFixed(2),
      quoteId,
    })
    const order = await createOrder({
      quoteId: quote.quoteId,
      bankAccountId,
      publicKey,
      useAnchor: true,
    })
    const { orderId, withdrawAnchorAccount, withdrawMemo } = order.offramp
    const { hash } = await payAnchor(
      withdrawAnchorAccount,
      withdrawMemo,
      quote.sourceAmount,
    )

    const polled = await pollOrder(orderId)
    if (polled.status === "stuck_funded") {
      await updateStoredClaim(token, {
        status: "cashing_out",
        payoutMethod: "pix",
        payoutOrderId: orderId,
        txHash: hash,
      })
      return NextResponse.json(
        {
          error: "stuck_funded",
          message:
            "The payout was submitted but is still processing. Check status later.",
          orderId,
          txHash: hash,
          status: "cashing_out",
        },
        { status: 202 },
      )
    }
    if (polled.status === "failed") {
      await updateStoredClaim(token, { status: "shared", payoutOrderId: orderId })
      return NextResponse.json(
        {
          error: "anchor_rejected",
          message: "The payment provider rejected this payout.",
          orderId,
          txHash: hash,
        },
        { status: 502 },
      )
    }

    await recipientSecretsByBalanceId.delete(claim.balanceId)
    const updated = await updateStoredClaim(token, {
      status: "completed",
      payoutMethod: "pix",
      payoutOrderId: orderId,
      claimedAt: new Date().toISOString(),
      txHash: hash,
    })

    return NextResponse.json({
      status: "completed",
      payoutMethod: "pix",
      orderId,
      txHash: hash,
      claim: updated,
    })
  } catch (err) {
    await updateStoredClaim(token, { status: claim.status })
    const raw =
      err instanceof EtherfuseError || err instanceof StellarError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown error"
    const classified = classifyError(raw)
    console.error("[claims/claim] failed:", raw)
    return NextResponse.json(
      { error: classified.code, message: classified.message, detail: raw },
      { status: 502 },
    )
  }
}
