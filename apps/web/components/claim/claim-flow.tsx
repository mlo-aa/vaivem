"use client"

import { ClaimLink } from "@vaivem/react"
import type { ClaimStatus, ProtectionType } from "@/lib/types"

export type PublicClaimView = {
  token: string
  senderName: string
  amount: number
  country: string
  message: string | null
  status: ClaimStatus
  deadline: number
  protectionType: ProtectionType
  requiresCode: boolean
  displayCurrency?: "BRL" | "USD"
  displayAmount?: number
}

/**
 * Thin host adapter: maps a public claim onto <ClaimLink /> from the kit.
 * Access code is verified against the server store — never hardcoded.
 */
export function ClaimFlow({ claim }: { claim: PublicClaimView }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  const country = claim.country === "MX" ? "MX" : "BR"

  return (
    <ClaimLink
      amount={claim.amount}
      fiatAmount={claim.displayCurrency === "BRL" ? claim.displayAmount : undefined}
      country={country}
      locale="pt-BR"
      claimToken={claim.token}
      requiresCode={claim.requiresCode || claim.protectionType === "code"}
      showDemoCodeHint={demoMode && claim.protectionType === "code"}
      demoMode={demoMode}
      apiBaseUrl=""
      onStatus={(status) => {
        // Status mapping: cashing_out while polling; completed only on success.
        void status
      }}
    />
  )
}
