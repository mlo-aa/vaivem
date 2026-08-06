import { defineRouting } from "next-intl/routing"

export const locales = ["en", "es", "pt-BR"] as const
export type AppLocale = (typeof locales)[number]

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: "en",
  localePrefix: "always",
})

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value)
}

/** Prefer browser language; fall back to pt-BR for claim links. */
export function detectClaimLocale(
  acceptLanguage: string | null,
): AppLocale {
  if (!acceptLanguage) return "pt-BR"
  const lower = acceptLanguage.toLowerCase()
  if (lower.includes("pt")) return "pt-BR"
  if (lower.includes("es")) return "es"
  if (lower.includes("en")) return "en"
  return "pt-BR"
}
