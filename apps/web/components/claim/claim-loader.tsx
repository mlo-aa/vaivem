"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { ClaimFlow, type PublicClaimView } from "@/components/claim/claim-flow"
import { ClaimShell } from "@/components/claim/claim-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getPublicClaim } from "@/lib/services"

export function ClaimLoader({ token }: { token: string }) {
  const t = useTranslations("claim")
  const [claim, setClaim] = useState<PublicClaimView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const found = await getPublicClaim(token)
        if (cancelled) return
        setClaim(found)
      } catch {
        if (cancelled) return
        setError(t("loadError"))
        setClaim(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  if (claim === undefined) {
    return (
      <ClaimShell>
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-14 w-52 rounded-2xl" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
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
          <CardHeader className="space-y-2">
            <p className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              {t("notFound")}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {error ?? t("notFoundBody")}
            </p>
          </CardHeader>
        </Card>
      </ClaimShell>
    )
  }

  if (["completed", "claimed", "refunded", "cancelled", "expired"].includes(claim.status)) {
    const received =
      claim.status === "completed" || claim.status === "claimed"
    return (
      <ClaimShell>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="space-y-2">
            <p className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              {received ? t("alreadyReceived") : t("unavailable")}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("unavailableBody")}
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
