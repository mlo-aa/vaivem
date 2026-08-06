/**
 * POST /api/auth/verify-code  { email, code }
 */

import { NextResponse } from "next/server"
import {
  COOKIE_NAME,
  createSessionToken,
  isValidEmail,
  MAX_AGE_SECONDS,
  normalizeEmail,
  sessionCookieOptions,
} from "@/lib/dashboard-session"
import { verifyAuthCode } from "@/lib/server/auth-code-store"
import { sessionStore } from "@/lib/server/session-store"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  let body: { email?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const email = normalizeEmail(String(body.email ?? ""))
  const code = String(body.code ?? "").replace(/\D/g, "")
  if (!isValidEmail(email) || code.length !== 6) {
    return NextResponse.json(
      { error: "Email and 6-digit code required" },
      { status: 400 },
    )
  }

  const result = await verifyAuthCode(email, code)
  if (!result.ok) {
    const status =
      result.error === "too_many_attempts" || result.error === "expired"
        ? 410
        : 401
    const message =
      result.error === "too_many_attempts"
        ? "Too many attempts. Request a new code."
        : result.error === "expired"
          ? "Code expired. Request a new one."
          : "Invalid code."
    return NextResponse.json({ error: result.error, message }, { status })
  }

  const user = await sessionStore.getOrCreateUser(email)
  const token = await createSessionToken(user.email)
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000).toISOString()
  await sessionStore.saveSession({
    sessionToken: token,
    userId: user.id,
    email: user.email,
    expiresAt,
    createdAt: new Date().toISOString(),
  })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  })
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
  return res
}
