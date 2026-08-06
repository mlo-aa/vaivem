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
      } catch {
        if (cancelled) return
        setError("Não foi possível carregar o pagamento. Tente novamente.")
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
            <p className="text-lg font-semibold text-foreground">Link não encontrado</p>
            <p className="text-sm text-muted-foreground">
              {error ?? "Este link não existe ou foi removido."}
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
                ? "Este valor já foi recebido"
                : "Pagamento indisponível"}
            </p>
            <p className="text-sm text-muted-foreground">
              Este pagamento não está mais disponível. Se precisar, peça um novo link para a
              pessoa que enviou.
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
