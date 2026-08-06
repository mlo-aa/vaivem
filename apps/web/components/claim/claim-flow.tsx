"use client"

import { useLocale } from "next-intl"
import { ClaimLink } from "@vaivem/react"
import type { ClaimStatus, ProtectionType } from "@/lib/types"
import type { AppLocale } from "@/i18n/routing"

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

function toKitLocale(locale: string): "en" | "es" | "pt-BR" {
  if (locale === "es" || locale === "pt-BR" || locale === "en") return locale
  return "pt-BR"
}

/**
 * Thin host adapter: maps a public claim onto <ClaimLink /> from the kit.
 * Locale comes from the URL (/pt-BR/claim/…) so the recipient can override.
 */
export function ClaimFlow({ claim }: { claim: PublicClaimView }) {
  const locale = useLocale() as AppLocale
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  const country = claim.country === "MX" ? "MX" : "BR"

  return (
    <ClaimLink
      amount={claim.amount}
      fiatAmount={claim.displayCurrency === "BRL" ? claim.displayAmount : undefined}
      country={country}
      locale={toKitLocale(locale)}
      claimToken={claim.token}
      requiresCode={claim.requiresCode || claim.protectionType === "code"}
      showDemoCodeHint={demoMode && claim.protectionType === "code"}
      demoMode={demoMode}
      apiBaseUrl=""
      onStatus={(status) => {
        void status
      }}
    />
  )
}
