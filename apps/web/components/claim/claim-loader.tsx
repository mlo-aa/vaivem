"use client"

import { useEffect, useState } from "react"
import { ClaimFlow, type PublicClaimView } from "@/components/claim/claim-flow"
import { ClaimShell } from "@/components/claim/claim-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getPublicClaim } from "@/lib/services"

export function ClaimLoader({ token }: { token: string }) {
  const [claim, setClaim] = useState<PublicClaimView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const found = await getPublicClaim(token)
        if (cancelled) return
        setClaim(found)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load claim")
        setClaim(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (claim === undefined) {
    return (
      <ClaimShell>
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </ClaimShell>
    )
  }

  if (claim === null) {
    return (
      <ClaimShell>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <p className="text-lg font-semibold text-foreground">Link not found</p>
            <p className="text-sm text-muted-foreground">
              {error ?? "This claim link doesn't exist or has been removed."}
            </p>
          </CardHeader>
        </Card>
      </ClaimShell>
    )
  }

  if (["completed", "claimed", "refunded", "cancelled", "expired"].includes(claim.status)) {
    return (
      <ClaimShell>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <p className="text-lg font-semibold text-foreground">
              {claim.status === "completed" || claim.status === "claimed"
                ? "Already claimed"
                : "Payout unavailable"}
            </p>
            <p className="text-sm text-muted-foreground">
              This claim is {claim.status}. Ask the sender for a new link if you still need funds.
            </p>
          </CardHeader>
        </Card>
      </ClaimShell>
    )
  }

  return (
    <ClaimShell>
      <ClaimFlow claim={claim} />
    </ClaimShell>
  )
}
