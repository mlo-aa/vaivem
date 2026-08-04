"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, SearchX } from "lucide-react"
import { ButtonLink } from "@/components/ui/button-link"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ClaimDetail } from "@/components/dashboard/claim-detail"
import { findClaim } from "@/lib/claim-store"
import type { Claim } from "@/lib/types"

export function ClaimDetailLoader({ token }: { token: string }) {
  const [state, setState] = useState<{ loading: boolean; claim: Claim | null }>({
    loading: true,
    claim: null,
  })

  useEffect(() => {
    // Resolve against the client store (seed + session-created claims).
    setState({ loading: false, claim: findClaim(token) })
  }, [token])

  if (state.loading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!state.claim) {
    return (
      <Empty className="mx-auto max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Claim not found</EmptyTitle>
          <EmptyDescription>
            {"We couldn't find a claim for "}
            <span className="font-mono">{token}</span>. It may have expired or been removed.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ButtonLink href="/dashboard/claims" variant="outline">
            <ArrowLeft data-icon="inline-start" />
            Back to claims
          </ButtonLink>
        </EmptyContent>
      </Empty>
    )
  }

  return <ClaimDetail claim={state.claim} />
}
