import { NextResponse } from "next/server"
import { isValidEmail, normalizeEmail } from "@/lib/dashboard-session"
import { createAuthCode } from "@/lib/server/auth-code-store"
import { sendLoginCode } from "@/lib/server/send-login-code"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = normalizeEmail(String(body.email ?? ""))
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }

  const created = await createAuthCode(email)
  if (!created.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many codes requested. Wait a few minutes and try again.",
      },
      { status: 429 },
    )
  }

  try {
    const { devMode } = await sendLoginCode(email, created.code)
    return NextResponse.json({
      ok: true,
      email,
      expiresInSeconds: 600,
      ...(devMode
        ? { devMode: true as const, code: created.code }
        : { devMode: false as const }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send code"
    console.error("[auth/request-code]", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
