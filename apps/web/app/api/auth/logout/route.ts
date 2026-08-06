/**
 * POST /api/auth/logout — clears the dashboard session cookie.
 */

import { NextResponse } from "next/server"
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/dashboard-auth"

export const dynamic = "force-dynamic"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, "", { ...sessionCookieOptions(0), maxAge: 0 })
  return res
}
