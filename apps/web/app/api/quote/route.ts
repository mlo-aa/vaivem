/**
 * Sole browser → Etherfuse gateway. The API key lives here, never on the client.
 *
 * Returns `source: "live" | "mock"` so the UI can tell where the number came from.
 *
 * Mock fallback is ONLY for provider outages (5xx, timeout, network).
 * A 4xx means the request is invalid — return the upstream status, do not fake a quote.
 *
 * CORS is permissive so apps/demo (and other hosts) can call this route via
 * apiBaseUrl without running their own quote backend.
 */

import { NextResponse } from "next/server"
import {
  createQuote,
  describeUpstreamError,
  SANDBOX_ASSETS,
  EtherfuseError,
} from "@/lib/server/etherfuse"
import { isBelowMinimum, minAmountMessage, MIN_AMOUNT_USDC } from "@/lib/limits"

export const dynamic = "force-dynamic"

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const CURRENCIES = { BR: "BRL", MX: "MXN" } as const
type CountryCode = keyof typeof CURRENCIES

export interface QuoteResponse {
  quoteId: string
  sourceAmount: string
  destinationAmount: string
  exchangeRate: string
  etherfuseMidMarketRate: string
  nominalRate: string
  feeBps: string
  feeAmount: string
  requiresSwap: boolean
  createdAt: string
  expiresAt: string
  currency: string
  source: "live" | "mock"
  note?: string
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS })
}

/** Mirrors the live shape. Values measured against the sandbox. */
function mockQuote(usdc: number, currency: string): QuoteResponse {
  const rate = currency === "BRL" ? 5.13193556 : 18.42
  const feeBps = 20
  const now = new Date()
  return {
    quoteId: `mock_${crypto.randomUUID()}`,
    sourceAmount: usdc.toFixed(2),
    destinationAmount: (usdc * rate * (1 - feeBps / 10000)).toFixed(5),
    exchangeRate: (rate * (1 - feeBps / 10000)).toFixed(8),
    etherfuseMidMarketRate: rate.toFixed(5),
    nominalRate: rate.toFixed(4),
    feeBps: String(feeBps),
    feeAmount: ((usdc * feeBps) / 10000).toFixed(2),
    requiresSwap: true,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 120_000).toISOString(),
    currency,
    source: "mock",
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  let amount: number
  let country: CountryCode

  try {
    const body = await req.json()
    amount = Number(body.amount)
    country = (body.country ?? "BR") as CountryCode
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "amount must be a positive number" }, 400)
  }
  if (!(country in CURRENCIES)) {
    return json({ error: `unsupported country: ${country}` }, 400)
  }

  const currency = CURRENCIES[country]

  // Etherfuse would answer 424 here; a clear message beats an upstream round-trip.
  if (isBelowMinimum(amount)) {
    return json(
      {
        error: "amount_below_minimum",
        message: minAmountMessage(currency),
        minAmountUsdc: MIN_AMOUNT_USDC,
      },
      422,
    )
  }

  try {
    const q = await createQuote({
      type: "offramp",
      sourceAsset: SANDBOX_ASSETS.USDC,
      targetAsset: currency,
      sourceAmount: amount.toFixed(2),
    })

    const out: QuoteResponse = {
      quoteId: q.quoteId,
      sourceAmount: q.sourceAmount,
      destinationAmount: q.destinationAmount,
      exchangeRate: q.exchangeRate,
      etherfuseMidMarketRate: q.etherfuseMidMarketRate,
      nominalRate: q.nominalRate,
      feeBps: q.feeBps,
      feeAmount: q.feeAmount,
      requiresSwap: q.requiresSwap,
      createdAt: q.createdAt,
      expiresAt: q.expiresAt,
      currency,
      source: "live",
    }
    return json(out)
  } catch (err) {
    // 4xx: provider is up and rejected the request. Do not degrade to mock.
    if (err instanceof EtherfuseError && err.status >= 400 && err.status < 500) {
      console.error(`[quote] Etherfuse rejected the request (${err.status}):`, err.message)
      return json(
        {
          error: "provider_rejected",
          message: describeUpstreamError(err.status, err.message, amount),
          upstreamStatus: err.status,
        },
        err.status,
      )
    }

    // 5xx, timeout, or network failure: provider outage → mock.
    const reason = err instanceof Error ? err.message : "unknown error"
    console.error("[quote] Etherfuse unavailable, degrading to mock:", reason)
    return json({ ...mockQuote(amount, currency), note: reason })
  }
}
