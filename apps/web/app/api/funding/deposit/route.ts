/**
 * POST /api/funding/deposit
 * Create an Etherfuse ON-RAMP order (fiat → USDC) and return deposit instructions.
 */

import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { savePendingDeposit } from "@/lib/server/balance-store"
import {
  createOnrampOrder,
  createQuote,
  EtherfuseError,
  getUsdcAssetId,
  resolveCryptoWallet,
  resolveMxnBankAccountId,
} from "@/lib/server/etherfuse"
import { getSponsorPublicKey } from "@/lib/server/stellar"

export const dynamic = "force-dynamic"

const SANDBOX_MXN_MAX = 500

export async function POST(req: Request) {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { amount?: number; currency?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const currency = String(body.currency ?? "MXN").toUpperCase()
  const amount = Number(body.amount)

  if (currency === "BRL") {
    return NextResponse.json(
      {
        error: "brl_onramp_unavailable",
        message:
          "BRL on-ramp is not yet available in the Etherfuse sandbox. Use MXN (max 500 MXN) to fund your demo balance.",
      },
      { status: 422 },
    )
  }

  if (currency !== "MXN") {
    return NextResponse.json(
      { error: "currency must be MXN or BRL" },
      { status: 400 },
    )
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 },
    )
  }

  if (amount > SANDBOX_MXN_MAX) {
    return NextResponse.json(
      {
        error: "amount_above_sandbox_limit",
        message: `Sandbox MXN on-ramps are capped at ${SANDBOX_MXN_MAX} MXN per order.`,
        maxAmount: SANDBOX_MXN_MAX,
      },
      { status: 422 },
    )
  }

  try {
    const sponsorKey = getSponsorPublicKey()
    const wallet = await resolveCryptoWallet(sponsorKey)
    const bankAccountId = await resolveMxnBankAccountId()
    const quoteId = crypto.randomUUID()

    const quote = await createQuote({
      type: "onramp",
      sourceAsset: "MXN",
      targetAsset: getUsdcAssetId(),
      sourceAmount: amount.toFixed(2),
      quoteId,
      walletAddress: wallet.publicKey,
    })

    const order = await createOnrampOrder({
      quoteId,
      bankAccountId,
      publicKey: wallet.publicKey,
      cryptoWalletId: wallet.walletId,
    })

    const usdcAmount = Math.round(Number(quote.destinationAmount) * 100) / 100
    await savePendingDeposit({
      orderId: order.onramp.orderId,
      ownerId: who.ownerId,
      currency: "MXN",
      fiatAmount: amount,
      usdcAmount,
      createdAt: new Date().toISOString(),
      credited: false,
    })

    return NextResponse.json({
      orderId: order.onramp.orderId,
      status: "created",
      currency: "MXN",
      fiatAmount: amount,
      usdcAmount,
      exchangeRate: quote.exchangeRate,
      expiresAt: quote.expiresAt,
      instructions: {
        depositClabe: order.onramp.depositClabe,
        depositAmount: order.onramp.depositAmount,
        depositBankName: order.onramp.depositBankName,
        depositAccountHolder: order.onramp.depositAccountHolder,
      },
      note:
        "Sandbox: simulate the SPEI deposit with Etherfuse fiat_received, then poll GET /api/funding/[orderId]. Production detects SPEI automatically. Credited USDC is a demo ledger entry — the shared sponsor wallet still holds the on-chain funds.",
    })
  } catch (err) {
    if (err instanceof EtherfuseError) {
      const msg = err.message
      if (/FailedToGetQuote/i.test(msg)) {
        return NextResponse.json(
          {
            error: "brl_onramp_unavailable",
            message:
              "BRL on-ramp is not yet available in the Etherfuse sandbox. Use MXN (max 500 MXN) to fund your demo balance.",
          },
          { status: 422 },
        )
      }
      console.error("[funding/deposit]", err.status, msg)
      return NextResponse.json({ error: msg }, { status: err.status >= 400 ? err.status : 502 })
    }
    const message = err instanceof Error ? err.message : "error desconocido"
    console.error("[funding/deposit]", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
