/**
 * Resolve caller from Authorization: Bearer sk_… or session cookie.
 */

import "server-only"

import { requireOwnerId } from "@/lib/server/auth-session"
import { resolveApiKey } from "@/lib/server/api-key-store"
import { sessionStore } from "@/lib/server/session-store"

export type ApiCaller =
  | {
      ok: true
      ownerId: string
      name: string | null
      email: string | null
      via: "api_key" | "session"
      keyId?: string
    }
  | { ok: false; status: 401 }

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

/** Public /api/v1 — Bearer API key only. */
export async function requireBearerOwner(req: Request): Promise<ApiCaller> {
  const raw = extractBearer(req)
  if (!raw) return { ok: false, status: 401 }

  const resolved = await resolveApiKey(raw)
  if (!resolved) return { ok: false, status: 401 }

  const user = await sessionStore.getUserByEmail(resolved.ownerId)
  return {
    ok: true,
    ownerId: resolved.ownerId,
    name: user?.name ?? null,
    email: user?.email ?? (resolved.ownerId.includes("@") ? resolved.ownerId : null),
    via: "api_key",
    keyId: resolved.keyId,
  }
}

/** Dashboard key management — session cookie only. */
export async function requireSessionOwner(): Promise<ApiCaller> {
  const who = await requireOwnerId()
  if (!who.ok) return { ok: false, status: 401 }
  return {
    ok: true,
    ownerId: who.ownerId,
    name: who.name,
    email: who.email,
    via: "session",
  }
}
