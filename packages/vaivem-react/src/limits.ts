/**
 * Provider limits.
 *
 * Etherfuse answers offramp quotes below ~1 USDC with HTTP 424. Behaviour in the
 * 0.4–0.5 range is inconsistent (0.42 and 0.50 succeed; 0.39, 0.45 and 0.48 fail
 * repeatably), so 1 USDC is the supported minimum.
 */

import { formatUSDC } from "./utils"

export const MIN_AMOUNT_USDC = 1

const CURRENCY = { BR: "BRL", MX: "MXN" } as const
const LOCALE = { BR: "pt-BR", MX: "es-MX" } as const
/** Mid-market rates measured in the sandbox. Only used before a live quote exists. */
const REFERENCE_RATE = { BR: 5.13193556, MX: 18.42 } as const

export function formatFiat(value: number, country: "BR" | "MX"): string {
  return value.toLocaleString(LOCALE[country], {
    style: "currency",
    currency: CURRENCY[country],
  })
}

/** The minimum in the recipient's currency, at `rate` when a quote is available. */
export function minAmountInFiat(country: "BR" | "MX", rate?: number | null): string {
  const applied =
    rate != null && Number.isFinite(rate) && rate > 0 ? rate : REFERENCE_RATE[country]
  // Rounded up so converting the shown value back never lands below the minimum.
  return formatFiat(Math.ceil(MIN_AMOUNT_USDC * applied * 100) / 100, country)
}

export function minAmountMessage(country: "BR" | "MX", rate?: number | null): string {
  return `Minimum cash-out is ${formatUSDC(MIN_AMOUNT_USDC)} — about ${minAmountInFiat(
    country,
    rate,
  )} at the current rate. Smaller amounts are rejected by the payment provider.`
}

export function isBelowMinimum(amountUsdc: number): boolean {
  return !Number.isFinite(amountUsdc) || amountUsdc < MIN_AMOUNT_USDC
}
