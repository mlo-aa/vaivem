/**
 * POST /api/auth/login  { password }
 * POST /api/auth/logout
 */

import { NextResponse } from "next/server"
import {
  COOKIE_NAME,
  createSessionToken,
  dashboardAuthConfigured,
  passwordMatches,
  sessionCookieOptions,
} from "@/lib/dashboard-auth"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!dashboardAuthConfigured()) {
    return NextResponse.json({
      ok: true,
      auth: "disabled",
      note: "DASHBOARD_PASSWORD is not set — dashboard is open.",
    })
  }

  if (!passwordMatches(String(body.password ?? ""))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const token = await createSessionToken()
  if (!token) {
    return NextResponse.json({ error: "Could not create session" }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
  return res
}
