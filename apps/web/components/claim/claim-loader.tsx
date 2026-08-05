"use client"

import { useEffect, useState } from "react"
import { ClaimFlow } from "@/components/claim/claim-flow"
import { ClaimShell } from "@/components/claim/claim-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { findClaimableClaim, markViewed } from "@/lib/claim-store"
import type { Claim } from "@/lib/types"

export function ClaimLoader({ token }: { token: string }) {
  const [claim, setClaim] = useState<Claim | null | undefined>(undefined)

  useEffect(() => {
    const found = findClaimableClaim(token)
    if (found) markViewed(found.token)
    setClaim(found)
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
              This claim link doesn&apos;t exist or has been removed.
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
