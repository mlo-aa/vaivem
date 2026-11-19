/**
 * POST /api/auth/demo — one-click public demo session (Stellar testnet).
 * Creates a throwaway user, credits a small test balance and sets the cookie.
 */

import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import {
  COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/dashboard-session"
import { creditDeposit } from "@/lib/server/balance-store"
import { DEMO_EMAIL_DOMAIN, demoConfig } from "@/lib/server/demo"
import { clientIp, hit } from "@/lib/server/rate-limit"
import { sessionStore } from "@/lib/server/session-store"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const cfg = demoConfig()
  if (!cfg.enabled) {
    return NextResponse.json({ error: "demo_disabled" }, { status: 404 })
  }

  const ip = clientIp(req)
  const [perIp, global] = await Promise.all([
    // Without a client address we cannot attribute the request: rely on the global cap.
    ip === "unknown"
      ? Promise.resolve({ ok: true, count: 0 })
      : hit(`demo-ip:${ip}`, cfg.perIpPerDay, 86400),
    hit("demo-global", cfg.globalPerDay, 86400),
  ])
  if (!perIp.ok || !global.ok) {
    return NextResponse.json(
      { error: "demo_busy", message: "The demo is busy right now. Try again later." },
      { status: 429 },
    )
  }

  const id = randomBytes(5).toString("hex")
  const email = `demo-${id}@${DEMO_EMAIL_DOMAIN}`
  const user = await sessionStore.getOrCreateUser(email)
  await creditDeposit(user.id, cfg.startBalance, `demo-${id}`)

  const token = await createSessionToken(user.email)
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    balance: cfg.startBalance,
  })
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(60 * 60 * 24))
  return res
}
