import { NextResponse } from "next/server"
import {
  COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0))
  return res
}
