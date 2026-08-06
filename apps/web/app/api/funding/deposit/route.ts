import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import { savePendingDeposit } from "@/lib/server/balance-store"
import {
  createOnrampOrder,
  createQuote,
  EtherfuseError,
  getOrder,
  getUsdcAssetId,
  resolveBrlBankAccountId,
  resolveCryptoWallet,
  resolveMxnBankAccountId,
} from "@/lib/server/etherfuse"
import { normalizeOnrampInstructions } from "@/lib/server/onramp-instructions"
import { getSponsorPublicKey } from "@/lib/server/stellar"

export const dynamic = "force-dynamic"

/** Sandbox caps both MXN and BRL at 500 (SandboxAmountExceeded above). */
const SANDBOX_FIAT_MAX = 500

type FundingCurrency = "MXN" | "BRL"

function parseCurrency(raw: unknown): FundingCurrency | null {
  const c = String(raw ?? "BRL").toUpperCase()
  if (c === "MXN" || c === "BRL") return c
  return null
}

export async function POST(req: Request) {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { amount?: number; currency?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const currency = parseCurrency(body.currency)
  const amount = Number(body.amount)

  if (!currency) {
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

  if (amount > SANDBOX_FIAT_MAX) {
    return NextResponse.json(
      {
        error: "amount_above_sandbox_limit",
        message: `Sandbox on-ramps are capped at ${SANDBOX_FIAT_MAX} ${currency} per order.`,
        maxAmount: SANDBOX_FIAT_MAX,
      },
      { status: 422 },
    )
  }

  try {
    const sponsorKey = getSponsorPublicKey()
    const wallet = await resolveCryptoWallet(sponsorKey)
    const bankAccountId =
      currency === "BRL"
        ? await resolveBrlBankAccountId()
        : await resolveMxnBankAccountId()
    const quoteId = crypto.randomUUID()

    const quote = await createQuote({
      type: "onramp",
      sourceAsset: currency,
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

    if (currency === "BRL") {
      console.log(
        "[funding/deposit] BRL onramp raw:",
        JSON.stringify(order.onramp),
      )
    }

    let statusPage: string | undefined
    try {
      const detail = await getOrder(order.onramp.orderId)
      if (typeof detail.statusPage === "string") {
        statusPage = detail.statusPage
      }
    } catch {
      /* optional */
    }

    const instructions = normalizeOnrampInstructions(
      order.onramp,
      currency,
      statusPage,
    )

    const usdcAmount = Math.round(Number(quote.destinationAmount) * 100) / 100
    await savePendingDeposit({
      orderId: order.onramp.orderId,
      ownerId: who.ownerId,
      currency,
      fiatAmount: amount,
      usdcAmount,
      createdAt: new Date().toISOString(),
      credited: false,
    })

    const note =
      currency === "BRL"
        ? "Sandbox: open the Etherfuse status page (or simulate fiat with fiat_received), then return here — pending deposits reconcile on load. Credited USDC is a demo ledger entry."
        : "Sandbox: simulate the SPEI deposit with Etherfuse fiat_received, then return here. Production detects SPEI automatically. Credited USDC is a demo ledger entry."

    return NextResponse.json({
      orderId: order.onramp.orderId,
      status: "created",
      currency,
      fiatAmount: amount,
      usdcAmount,
      exchangeRate: quote.exchangeRate,
      expiresAt: quote.expiresAt,
      instructions,
      note,
    })
  } catch (err) {
    if (err instanceof EtherfuseError) {
      const msg = err.message
      if (/SandboxAmountExceeded/i.test(msg)) {
        return NextResponse.json(
          {
            error: "amount_above_sandbox_limit",
            message: `Sandbox on-ramps are capped at ${SANDBOX_FIAT_MAX} ${currency} per order.`,
            maxAmount: SANDBOX_FIAT_MAX,
          },
          { status: 422 },
        )
      }
      console.error("[funding/deposit]", err.status, msg)
      return NextResponse.json({ error: msg }, { status: err.status >= 400 ? err.status : 502 })
    }
    const message = err instanceof Error ? err.message : "unknown error"
    console.error("[funding/deposit]", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
