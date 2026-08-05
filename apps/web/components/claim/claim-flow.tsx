"use client"

import { ClaimLink } from "@vaivem/react"
import { saveClaim } from "@/lib/claim-store"
import type { Claim } from "@/lib/types"

const DEMO_CODE = "482913"

/**
 * Thin host adapter: maps a Claim record onto the importable <ClaimLink /> kit.
 */
export function ClaimFlow({ claim }: { claim: Claim }) {
  return (
    <ClaimLink
      code={DEMO_CODE}
      amount={claim.amount}
      apiBaseUrl=""
      onClaimed={() => {
        saveClaim({
          ...claim,
          status: "completed",
          claimedAt: new Date().toISOString(),
          payoutMethod: claim.payoutMethod ?? "pix",
        })
      }}
    />
  )
}
