import { NextResponse } from "next/server"
import { requireOwnerId } from "@/lib/server/auth-session"
import {
  createClaimForOwner,
  type CreateClaimInput,
} from "@/lib/server/create-claim-for-owner"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const who = await requireOwnerId()
  if (!who.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as CreateClaimInput
    const result = await createClaimForOwner(
      { ownerId: who.ownerId, name: who.name, email: who.email },
      body,
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

    const d = result.data
    return NextResponse.json({
      token: d.token,
      url: d.url,
      deadline: d.deadline,
      balanceId: d.balanceId,
      hash: d.hash,
      amount: d.amount,
      ownerId: d.ownerId,
      senderName: d.senderName,
      batchId: d.batchId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    console.error("[claims/create] failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
