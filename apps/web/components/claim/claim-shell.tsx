"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Logo } from "@/components/logo"
import { LanguageSwitcher } from "@/components/language-switcher"

/**
 * Recipient chrome for /claim/* — light, bank-like. Language override in header.
 */
export function ClaimShell({ children }: { children: ReactNode }) {
  const t = useTranslations("claim")
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f7f5]">
      <header className="flex items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-2.5">
          <Logo />
          <div className="flex flex-wrap gap-2">
            {demoMode ? (
              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
                {t("demo")}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-inset ring-black/5">
              {t("onlyForYou")}
            </span>
          </div>
        </div>
        <LanguageSwitcher compact />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-20 pt-4 sm:items-center sm:px-6 sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
