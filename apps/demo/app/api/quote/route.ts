import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Standalone mock quote so the demo app runs without apps/web. */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const amount = Number(body.amount)
    const country = (body.country ?? "BR") as "BR" | "MX"
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 })
    }
    const rate = country === "BR" ? 5.13193556 : 18.42
    const feeBps = 20
    const now = new Date()
    return NextResponse.json({
      quoteId: `demo_${crypto.randomUUID()}`,
      sourceAmount: amount.toFixed(2),
      destinationAmount: (amount * rate * (1 - feeBps / 10000)).toFixed(5),
      exchangeRate: (rate * (1 - feeBps / 10000)).toFixed(8),
      etherfuseMidMarketRate: rate.toFixed(5),
      nominalRate: rate.toFixed(4),
      feeBps: String(feeBps),
      feeAmount: ((amount * feeBps) / 10000).toFixed(2),
      requiresSwap: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 120_000).toISOString(),
      currency: country === "BR" ? "BRL" : "MXN",
      source: "mock",
      note: "demo app mock quote",
    })
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
}
