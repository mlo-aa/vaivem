/**
 * POST /api/auth/logout — clear session cookie.
 */

import { NextResponse } from "next/server"
import {
  COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/dashboard-session"
import { cookies } from "next/headers"
import { sessionStore } from "@/lib/server/session-store"

export const dynamic = "force-dynamic"

export async function POST() {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (token) {
    await sessionStore.deleteSession(token)
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0))
  return res
}
