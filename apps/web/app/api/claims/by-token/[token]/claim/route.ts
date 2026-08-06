/**
 * POST /api/claims/by-token/[token]/claim
 *
 * rail=pix  → quote + off-ramp order FIRST, then claim CB, then payAnchor.
 *             If the provider fails before claim, the escrow CB stays intact.
 *             If payout fails after claim, USDC returns to sponsor and we
 *             recreate the claimable balance so the link stays claimable.
 * rail=stellar → claimAndForward to recipient's own address (non-custodial).
 *
 * Body: { rail, accessCode?, walletAddress? }
 */

import { NextResponse } from "next/server"
import {
  claimAndForward,
  claimBalance,
  createClaimableBalance,
  getSponsorPublicKey,
  payAnchor,
  returnSponsoredUsdcToSponsor,
  StellarError,
} from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"
import {
  getStoredClaim,
  updateStoredClaim,
  type StoredClaim,
} from "@/lib/server/claim-store"
import {
  createOrder,
  createQuote,
  EtherfuseError,
  getOrder,
  getUsdcAssetId,
  requireBankAccountIdForCurrency,
} from "@/lib/server/etherfuse"

export const dynamic = "force-dynamic"

const POLL_MS = 2000
const POLL_TIMEOUT_MS = 90_000

function classifyError(message: string): { code: string; message: string } {
  const m = message.toLowerCase()
  if (
    m.includes("failedtogetquote") ||
    m.includes("failed to get quote") ||
    m.includes("temporarily unavailable") ||
    m.includes("etherfuse 424") ||
    m.includes("provider_rejected")
  ) {
    return {
      code: "provider_rejected",
      message:
        "This cash-out corridor is temporarily unavailable from the payment provider. Try again later or keep the USDC on Stellar.",
    }
  }
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

/**
 * After claimBalance consumed the CB but the off-ramp did not settle,
 * return USDC to the sponsor and recreate escrow so the link stays claimable.
 */
async function restoreEscrowAfterFailedPayout(
  claim: StoredClaim,
  secret: string,
): Promise<StoredClaim> {
  const amount = claim.amount.toFixed(2)
  await returnSponsoredUsdcToSponsor(secret, amount)

  const remaining = Math.max(60, claim.deadline - Math.floor(Date.now() / 1000))
  const { balanceId, deadline } = await createClaimableBalance(
    claim.recipientPublicKey,
    amount,
    remaining,
  )

  await recipientSecretsByBalanceId.delete(claim.balanceId)
  await recipientSecretsByBalanceId.set(balanceId, secret, deadline)

  const updated = await updateStoredClaim(claim.token, {
    balanceId,
    deadline,
    expiresAt: new Date(deadline * 1000).toISOString(),
    status: "shared",
    payoutMethod: null,
    payoutOrderId: null,
    txHash: null,
    claimedAt: null,
  })
  return updated ?? { ...claim, balanceId, deadline, status: "shared" }
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

  /** True only after claimBalance succeeds — triggers escrow restore on failure. */
  let escrowClaimed = false

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

    // Local bank cash-out: corridor from claim.country (BR→PIX/BRL, MX→SPEI/MXN).
    // Quote + order BEFORE touching the claimable balance.
    const corridorCountry = claim.country === "MX" ? "MX" : "BR"
    const targetAsset = corridorCountry === "MX" ? "MXN" : "BRL"
    const payoutMethod = corridorCountry === "MX" ? "spei" : "pix"
    const bankAccountId = await requireBankAccountIdForCurrency(targetAsset)
    const sourceAsset = getUsdcAssetId()
    const publicKey = getSponsorPublicKey()
    const quoteId = crypto.randomUUID()
    const quote = await createQuote({
      type: "offramp",
      sourceAsset,
      targetAsset,
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

    // Anchor destination is ready — now claim the escrow.
    await claimBalance(claim.balanceId, secret)
    escrowClaimed = true

    const { hash } = await payAnchor(
      withdrawAnchorAccount,
      withdrawMemo,
      quote.sourceAmount,
    )

    const polled = await pollOrder(orderId)
    if (polled.status === "stuck_funded") {
      // Anchor payment submitted; do not pretend the link is still claimable.
      await updateStoredClaim(token, {
        status: "cashing_out",
        payoutMethod,
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
      // Sponsor already paid the anchor — leave residue accounting; mark unavailable.
      await updateStoredClaim(token, {
        status: "cashing_out",
        payoutMethod,
        payoutOrderId: orderId,
        txHash: hash,
      })
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
      payoutMethod,
      payoutOrderId: orderId,
      claimedAt: new Date().toISOString(),
      txHash: hash,
    })

    return NextResponse.json({
      status: "completed",
      payoutMethod,
      orderId,
      txHash: hash,
      claim: updated,
    })
  } catch (err) {
    const raw =
      err instanceof EtherfuseError || err instanceof StellarError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown error"
    const classified = classifyError(raw)
    console.error("[claims/claim] failed:", raw)

    if (escrowClaimed) {
      try {
        await restoreEscrowAfterFailedPayout(claim, secret)
      } catch (restoreErr) {
        console.error(
          "[claims/claim] escrow restore failed:",
          restoreErr instanceof Error ? restoreErr.message : restoreErr,
        )
        // Never leave status as claimable without a CB.
        await updateStoredClaim(token, { status: "cashing_out" })
        return NextResponse.json(
          {
            error: "payout_failed",
            message:
              "The payout failed and escrow could not be restored automatically. Contact the sender.",
            detail: raw,
          },
          { status: 502 },
        )
      }
    } else {
      await updateStoredClaim(token, { status: "shared" })
    }

    return NextResponse.json(
      { error: classified.code, message: classified.message, detail: raw },
      { status: 502 },
    )
  }
}
