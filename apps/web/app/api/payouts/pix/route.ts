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
  EtherfuseError,
  getUsdcAssetId,
  requireBankAccountId,
} from "@/lib/server/etherfuse"
import { getSponsorPublicKey, payAnchor, StellarError } from "@/lib/server/stellar"

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

  try {
    const bankAccountId = requireBankAccountId()
    const sourceAsset = getUsdcAssetId()
    const publicKey = getSponsorPublicKey()
    const quoteId = crypto.randomUUID()

    // 1. Quote (orderId must later equal this quoteId)
    const quote = await createQuote({
      type: "offramp",
      sourceAsset,
      targetAsset: "BRL",
      sourceAmount: amount.toFixed(2),
      quoteId,
    })

    // 2. Order with useAnchor
    const order = await createOrder({
      quoteId: quote.quoteId,
      bankAccountId,
      publicKey,
      useAnchor: true,
    })

    const {
      orderId,
      withdrawAnchorAccount,
      withdrawMemo,
    } = order.offramp

    // 3. Pay anchor with exact hash memo
    const { hash } = await payAnchor(
      withdrawAnchorAccount,
      withdrawMemo,
      quote.sourceAmount,
    )

    const out: PixPayoutResponse = {
      orderId,
      txHash: hash,
      status: "submitted",
      source: "live",
    }
    return NextResponse.json(out)
  } catch (err) {
    const reason =
      err instanceof EtherfuseError || err instanceof StellarError
        ? err.message
        : "error desconocido"
    console.error("[payouts/pix] falló, degradando a mock:", reason)
    return NextResponse.json({ ...mockPayout(amount), note: reason })
  }
}
