import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { COOKIE_NAME, verifySessionToken } from "@/lib/dashboard-session"
import { sessionStore } from "@/lib/server/session-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const jar = await cookies()
  const payload = await verifySessionToken(jar.get(COOKIE_NAME)?.value)
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = await sessionStore.getUserByEmail(payload.email)
  return NextResponse.json({
    user: {
      id: user?.id ?? payload.email,
      email: payload.email,
      name: user?.name ?? payload.email.split("@")[0],
    },
  })
}
