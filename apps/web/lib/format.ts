import type { ClaimStatus } from "./types"
import type { AppLocale } from "@/i18n/routing"

export const USD_TO_BRL = 5.13193556

const BCP47: Record<AppLocale, string> = {
  en: "en-US",
  es: "es-MX",
  "pt-BR": "pt-BR",
}

export function toBcp47(locale?: string | null): string {
  if (locale === "es") return BCP47.es
  if (locale === "pt-BR") return BCP47["pt-BR"]
  if (locale === "en") return BCP47.en
  return BCP47.en
}

export function formatUSDC(value: number, locale?: string | null): string {
  return `${value.toLocaleString(toBcp47(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`
}

export function formatBRL(value: number, locale?: string | null): string {
  return value.toLocaleString(toBcp47(locale ?? "pt-BR"), {
    style: "currency",
    currency: "BRL",
  })
}

export function formatUSD(value: number, locale?: string | null): string {
  return value.toLocaleString(toBcp47(locale ?? "en"), {
    style: "currency",
    currency: "USD",
  })
}

export function formatDisplay(
  value: number,
  currency: "BRL" | "USD",
  locale?: string | null,
): string {
  return currency === "BRL"
    ? formatBRL(value, locale)
    : formatUSD(value, locale)
}

export function formatDateTime(iso: string, locale?: string | null): string {
  return new Date(iso).toLocaleString(toBcp47(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Prefer next-intl `t` from `time` namespace when available. */
export function relativeTime(
  iso: string,
  t?: (key: string, values?: Record<string, number>) => string,
): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (t) {
    if (mins < 1) return t("justNow")
    if (mins < 60) return t("minutesAgo", { n: mins })
    const hours = Math.round(mins / 60)
    if (hours < 24) return t("hoursAgo", { n: hours })
    return t("daysAgo", { n: Math.round(hours / 24) })
  }
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function timeUntil(
  iso: string,
  t?: (key: string, values?: Record<string, number>) => string,
): {
  expired: boolean
  label: string
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) {
    return {
      expired: true,
      label: t ? t("expired") : "Expired",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    }
  }
  const seconds = Math.floor(diff / 1000) % 60
  const minutes = Math.floor(diff / 60000) % 60
  const hours = Math.floor(diff / 3600000) % 24
  const days = Math.floor(diff / 86400000)
  const label = t
    ? days > 0
      ? t("daysHoursLeft", { days, hours })
      : hours > 0
        ? t("hoursMinutesLeft", { hours, minutes })
        : t("minutesSecondsLeft", { minutes, seconds })
    : days > 0
      ? `${days}d ${hours}h left`
      : hours > 0
        ? `${hours}h ${minutes}m left`
        : `${minutes}m ${seconds}s left`
  return { expired: false, label, days, hours, minutes, seconds }
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@")
  if (!domain) return email
  const visible = name.slice(0, 2)
  return `${visible}${"•".repeat(Math.max(name.length - 2, 2))}@${domain}`
}

export function maskStellarAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

interface StatusMeta {
  label: string
  tone: "brand" | "info" | "warning" | "muted" | "destructive" | "success"
}

export const STATUS_META: Record<ClaimStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "muted" },
  funded: { label: "Funded", tone: "info" },
  shared: { label: "Shared", tone: "info" },
  viewed: { label: "Viewed", tone: "info" },
  claimed: { label: "Claimed", tone: "brand" },
  cashing_out: { label: "Cashing out", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  expired: { label: "Expired", tone: "muted" },
  refunded: { label: "Refunded", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "destructive" },
}

export function isActiveStatus(status: ClaimStatus): boolean {
  return ["funded", "shared", "viewed", "claimed", "cashing_out"].includes(status)
}

/** Map API `error` codes to a messages `errors.*` key. */
export function apiErrorKey(code: string | undefined | null): string {
  if (!code) return "unknown"
  return code
}
