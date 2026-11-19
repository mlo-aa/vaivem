/**
 * GET /api/health — which parts of the deployment are configured and reachable.
 * Booleans and public on-chain numbers only; never secrets.
 */

import { NextResponse } from "next/server"
import { hasAuthSecret } from "@/lib/dashboard-session"
import { demoConfig } from "@/lib/server/demo"
import { clientIp, hit } from "@/lib/server/rate-limit"
import { getAccountState, getSponsorPublicKey } from "@/lib/server/stellar"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const limited = await hit(`health:${clientIp(req)}`, 30, 60)
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 })

  const kv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  const sponsor: { configured: boolean; exists: boolean; xlm: number | null; usdc: number | null; error?: string } = {
    configured: Boolean(process.env.STELLAR_SPONSOR_SECRET && process.env.STELLAR_USDC_ISSUER),
    exists: false,
    xlm: null,
    usdc: null,
  }
  if (sponsor.configured) {
    try {
      const state = await getAccountState(getSponsorPublicKey())
      const bal = (code: string) => Number(state.balances.find((b) => b.asset === code)?.balance ?? 0)
      sponsor.exists = true
      sponsor.xlm = bal("XLM")
      sponsor.usdc = bal("USDC")
    } catch (err) {
      sponsor.error = err instanceof Error ? err.message.slice(0, 120) : "unreachable"
    }
  }

  const checks = {
    authSecret: hasAuthSecret(),
    kv,
    emailLogin: Boolean(process.env.RESEND_API_KEY),
    demoLogin: demoConfig().enabled,
    etherfuse: Boolean(process.env.ETHERFUSE_API_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    network: process.env.STELLAR_NETWORK ?? "testnet",
    sponsor,
  }
  // The public demo needs: session secret, durable storage, a funded sponsor.
  const ok = checks.authSecret && checks.kv && sponsor.exists && (sponsor.usdc ?? 0) > 0
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 })
}
