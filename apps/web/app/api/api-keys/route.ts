/**
 * Dashboard — manage API keys (session auth).
 *
 * GET  /api/api-keys — list
 * POST /api/api-keys — create { name? } → returns secret once
 * DELETE /api/api-keys?id=… — revoke
 */

import { NextResponse } from "next/server"
import { requireSessionOwner } from "@/lib/server/api-auth"
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/server/api-key-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const who = await requireSessionOwner()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const keys = await listApiKeys(who.ownerId)
  return NextResponse.json({ keys })
}

export async function POST(req: Request) {
  const who = await requireSessionOwner()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let name = "Default"
  try {
    const body = (await req.json()) as { name?: string }
    if (body.name?.trim()) name = body.name.trim().slice(0, 64)
  } catch {
    /* empty body ok */
  }

  const { key, secret } = await createApiKey(who.ownerId, name)
  return NextResponse.json({ key, secret }, { status: 201 })
}

export async function DELETE(req: Request) {
  const who = await requireSessionOwner()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 })
  }

  const revoked = await revokeApiKey(who.ownerId, id)
  if (!revoked) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  return NextResponse.json({ key: revoked })
}
