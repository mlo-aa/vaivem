/**
 * POST /api/payouts/pix
 *
 * Verified Etherfuse offramp cycle (sandbox):
 *   1. POST /ramp/quote  (offramp USDC → BRL, 120s TTL)
 *   2. POST /ramp/order  (orderId === quoteId, useAnchor: true, publicKey)
 *   3. Stellar payment to withdrawAnchorAccount with Memo.hash(base64 memo)
 *
 * Returns { orderId, txHash, status, source }. Poll GET /api/payouts/[orderId]
 * until status === "completed".
 *
 * Clasificación de fallos, por fase:
 *   - Config + quote: un 5xx/timeout/red degrada a mock (nada se movió todavía).
 *   - Order: fallo real (502). Ya hay una orden viva del lado del proveedor.
 *   - payAnchor: fallo real con el result code de Horizon traducido. Nunca mock:
 *     un 200 acá le muestra "Money on the way!" a alguien a quien no le llegó nada.
 *   - Etherfuse 4xx en cualquier fase: provider_rejected con el status de upstream.
 *
 * Sender wallet (STELLAR_SPONSOR_SECRET) preconditions — each failed distinctly
 * during the spike:
 *   - registered as a wallet in the Etherfuse account
 *     → "Wallet not found or not authorized"
 *   - has a trustline for USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *     → "Your wallet does not have a trustline"
 *   - bank account (ETHERFUSE_BRL_BANK_ACCOUNT_ID) must be compliant:true
 *     → "Bank account is not compliant with KYC"
 *   - holds Etherfuse-issued USDC, not self-issued testnet USDC
 */

import { NextResponse } from "next/server"
import {
  createOrder,
  createQuote,
  describeUpstreamError,
  EtherfuseError,
  getUsdcAssetId,
  requireBankAccountId,
} from "@/lib/server/etherfuse"
import {
  describeStellarFailure,
  getSponsorPublicKey,
  payAnchor,
  StellarError,
} from "@/lib/server/stellar"
import { isBelowMinimum, minAmountMessage, MIN_AMOUNT_USDC } from "@/lib/limits"

export const dynamic = "force-dynamic"

export interface PixPayoutResponse {
  orderId: string
  txHash: string
  status: string
  source: "live" | "mock"
  note?: string
}

function mockPayout(amount: number): PixPayoutResponse {
  return {
    orderId: `mock_${crypto.randomUUID()}`,
    txHash: Array.from({ length: 64 }, () =>
      "abcdef0123456789"[Math.floor(Math.random() * 16)],
    ).join(""),
    status: "submitted",
    source: "mock",
  }
}

export async function POST(req: Request) {
  let amount: number

  try {
    const body = await req.json()
    amount = Number(body.amount)
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount debe ser un número positivo" },
      { status: 400 },
    )
  }

  // Etherfuse would answer 424 here; a clear message beats an upstream round-trip.
  if (isBelowMinimum(amount)) {
    return NextResponse.json(
      {
        error: "amount_below_minimum",
        message: minAmountMessage("BRL"),
        minAmountUsdc: MIN_AMOUNT_USDC,
      },
      { status: 422 },
    )
  }

  // --- Phase 1: config + quote. Nothing has moved, so an outage can still mock.
  let bankAccountId: string
  let publicKey: string
  let quote: Awaited<ReturnType<typeof createQuote>>
  try {
    bankAccountId = requireBankAccountId()
    publicKey = getSponsorPublicKey()
    quote = await createQuote({
      type: "offramp",
      sourceAsset: getUsdcAssetId(),
      targetAsset: "BRL",
      sourceAmount: amount.toFixed(2),
      quoteId: crypto.randomUUID(),
    })
  } catch (err) {
    const rejected = providerRejection(err, amount)
    if (rejected) return rejected

    const reason = errorMessage(err)
    console.error("[payouts/pix] proveedor no disponible en el quote, degradando a mock:", reason)
    return NextResponse.json({ ...mockPayout(amount), note: reason })
  }

  // --- Phase 2: order. The provider now holds a live order — report failures.
  let order: Awaited<ReturnType<typeof createOrder>>
  try {
    order = await createOrder({
      quoteId: quote.quoteId,
      bankAccountId,
      publicKey,
      useAnchor: true,
    })
  } catch (err) {
    const rejected = providerRejection(err, amount)
    if (rejected) return rejected

    const reason = errorMessage(err)
    console.error("[payouts/pix] falló la creación de la orden:", reason)
    return NextResponse.json(
      {
        error: "order_failed",
        message:
          "We couldn't open the payout order with the payment provider. Nothing was sent — try again.",
        detail: reason,
      },
      { status: 502 },
    )
  }

  const { orderId, withdrawAnchorAccount, withdrawMemo } = order.offramp

  // --- Phase 3: payment attempted. Never mock, never 200 on failure.
  let txHash: string
  try {
    const { hash } = await payAnchor(withdrawAnchorAccount, withdrawMemo, quote.sourceAmount)
    txHash = hash
  } catch (err) {
    const rejected = providerRejection(err, amount)
    if (rejected) return rejected

    const failure = describeStellarFailure(err)
    console.error(
      `[payouts/pix] el pago al anchor falló (${failure.code}):`,
      errorMessage(err),
    )
    return NextResponse.json(
      {
        error: failure.code,
        message: failure.message,
        orderId,
        resultCodes: err instanceof StellarError ? err.resultCodes : undefined,
      },
      { status: 502 },
    )
  }

  const out: PixPayoutResponse = {
    orderId,
    txHash,
    status: "submitted",
    source: "live",
  }
  return NextResponse.json(out)
}

/** Etherfuse 4xx: the provider is up and rejected us. Same shape in every phase. */
function providerRejection(err: unknown, amount: number) {
  if (!(err instanceof EtherfuseError) || err.status < 400 || err.status >= 500) return null
  console.error(`[payouts/pix] Etherfuse rechazó la solicitud (${err.status}):`, err.message)
  return NextResponse.json(
    {
      error: "provider_rejected",
      message: describeUpstreamError(err.status, err.message, amount),
      upstreamStatus: err.status,
    },
    { status: err.status },
  )
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "error desconocido"
}
