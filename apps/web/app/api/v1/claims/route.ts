/**
 * Public API — create a claim with Bearer API key.
 *
 * POST /api/v1/claims
 * Authorization: Bearer sk_test_… | sk_live_…
 */

import { NextResponse } from "next/server"
import { requireBearerOwner } from "@/lib/server/api-auth"
import {
  createClaimForOwner,
  serializeClaimForApi,
} from "@/lib/server/create-claim-for-owner"
import { getStoredClaim } from "@/lib/server/claim-store"
import type { ProtectionType } from "@/lib/types"

export const dynamic = "force-dynamic"

type V1Body = {
  amount?: string | number
  currency?: string
  country?: string
  recipient?: { name?: string; email?: string }
  recipientName?: string
  recipientEmail?: string
  protection?: ProtectionType
  protectionType?: ProtectionType
  accessCode?: string
  message?: string
  purpose?: string
  reference?: string
  expirationDays?: number
  allowPix?: boolean
  allowStellar?: boolean
  batchId?: string
}

export async function POST(req: Request) {
  const who = await requireBearerOwner(req)
  if (!who.ok) {
    return NextResponse.json(
      { error: "unauthorized", message: "Valid Bearer API key required" },
      { status: 401 },
    )
  }

  let body: V1Body
  try {
    body = (await req.json()) as V1Body
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON" },
      { status: 400 },
    )
  }

  const amountRaw = body.amount
  const amount =
    typeof amountRaw === "string" ? Number.parseFloat(amountRaw) : Number(amountRaw)

  const currency = (body.currency ?? "BRL").toUpperCase()
  const displayCurrency = currency === "USD" ? "USD" : "BRL"
  const protectionType = (body.protectionType ??
    body.protection ??
    "email") as ProtectionType

  const recipientName =
    body.recipient?.name ?? body.recipientName ?? ""
  const recipientEmail =
    body.recipient?.email ?? body.recipientEmail ?? null

  const result = await createClaimForOwner(
    { ownerId: who.ownerId, name: who.name, email: who.email },
    {
      amount,
      country: body.country ?? "BR",
      recipientName,
      recipientEmail,
      message: body.message ?? null,
      protectionType,
      accessCode: body.accessCode ?? null,
      expirationDays: body.expirationDays ?? 7,
      displayCurrency,
      displayAmount: amount,
      purpose: body.purpose ?? "Payout",
      reference: body.reference ?? null,
      batchId: body.batchId ?? null,
      allowPix: body.allowPix,
      allowStellar: body.allowStellar,
    },
  )

  if (!result.ok) {
    const { failure } = result
    return NextResponse.json(
      {
        error: failure.error,
        message: failure.message,
        available: failure.available,
        required: failure.required,
        minAmountUsdc: failure.minAmountUsdc,
      },
      { status: failure.status },
    )
  }

  const stored = await getStoredClaim(result.data.token)
  if (stored) {
    return NextResponse.json(serializeClaimForApi(stored), { status: 201 })
  }

  return NextResponse.json(
    {
      id: result.data.id,
      token: result.data.token,
      status: result.data.status,
      amount: { asset: "USDC", value: String(result.data.amount) },
      claimUrl: result.data.claimUrl,
      createdAt: result.data.createdAt,
    },
    { status: 201 },
  )
}
