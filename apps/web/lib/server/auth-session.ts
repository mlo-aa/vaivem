import "server-only"

import { cookies } from "next/headers"
import { COOKIE_NAME, verifySessionToken } from "@/lib/dashboard-session"
import { sessionStore } from "@/lib/server/session-store"

export async function requireOwnerId(): Promise<
  | { ok: true; ownerId: string; name: string | null; email: string | null }
  | { ok: false; status: 401 }
> {
  const jar = await cookies()
  const payload = await verifySessionToken(jar.get(COOKIE_NAME)?.value)
  if (!payload) return { ok: false, status: 401 }
  const user = await sessionStore.getUserByEmail(payload.email)
  return {
    ok: true,
    ownerId: user?.id ?? payload.email,
    name: user?.name ?? null,
    email: payload.email,
  }
}

export async function optionalOwnerId(): Promise<string | null> {
  const jar = await cookies()
  const payload = await verifySessionToken(jar.get(COOKIE_NAME)?.value)
  return payload?.email ?? null
}
