/**
 * app/api/quote/route.ts
 *
 * Única puerta entre el navegador y Etherfuse. La API key vive acá,
 * nunca en el cliente.
 *
 * Devuelve `source: "live" | "mock"` para que la UI pueda decir la verdad
 * sobre de dónde salió el número. Si Etherfuse falla, la demo sigue con
 * datos simulados y la pantalla lo indica — nunca se finge una cotización real.
 *
 * CORS is permissive so apps/demo (and other hosts) can call this route via
 * apiBaseUrl without running their own quote backend.
 */

import { NextResponse } from "next/server"
import { createQuote, SANDBOX_ASSETS, EtherfuseError } from "@/lib/server/etherfuse"

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

/** Réplica de la forma real. Valores medidos contra el sandbox. */
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
    return json({ error: "JSON inválido" }, 400)
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "amount debe ser un número positivo" }, 400)
  }
  if (!(country in CURRENCIES)) {
    return json({ error: `país no soportado: ${country}` }, 400)
  }

  const currency = CURRENCIES[country]

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
    const reason = err instanceof EtherfuseError ? err.message : "error desconocido"
    console.error("[quote] Etherfuse falló, degradando a mock:", reason)
    return json({ ...mockQuote(amount, currency), note: reason })
  }
}
