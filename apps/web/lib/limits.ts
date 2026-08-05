/**
 * Provider limits, shared by the API routes and the create wizard.
 *
 * Etherfuse answers offramp quotes below ~1 USDC with HTTP 424, and behaviour in
 * the 0.4–0.5 range is inconsistent (0.42 and 0.50 succeed; 0.39, 0.45 and 0.48
 * fail repeatably), so 1 USDC is the supported minimum.
 *
 * Keep MIN_AMOUNT_USDC in sync with the same constant in @vaivem/react — the kit
 * cannot be imported from a route handler (it ships client components and CSS).
 */

export const MIN_AMOUNT_USDC = 1

/** Mid-market rates measured in the sandbox. Used for messaging, never for settlement. */
export const REFERENCE_RATES = { BRL: 5.13193556, MXN: 18.42, USD: 1 } as const

export type SupportedCurrency = keyof typeof REFERENCE_RATES

const LOCALES: Record<SupportedCurrency, string> = {
  BRL: "pt-BR",
  MXN: "es-MX",
  USD: "en-US",
}

/** The minimum expressed in `currency`, at `rate` when one is known. */
export function formatMinAmount(currency: SupportedCurrency, rate?: number): string {
  const applied = rate != null && Number.isFinite(rate) && rate > 0 ? rate : REFERENCE_RATES[currency]
  // Rounded up so converting the shown value back never lands below the minimum.
  const value = Math.ceil(MIN_AMOUNT_USDC * applied * 100) / 100
  return value.toLocaleString(LOCALES[currency], { style: "currency", currency })
}

export function minAmountMessage(currency: SupportedCurrency, rate?: number): string {
  return `Minimum amount is ${MIN_AMOUNT_USDC.toFixed(2)} USDC — about ${formatMinAmount(
    currency,
    rate,
  )} at the current rate. Smaller amounts are rejected by the payment provider.`
}

export function isBelowMinimum(amountUsdc: number): boolean {
  return !Number.isFinite(amountUsdc) || amountUsdc < MIN_AMOUNT_USDC
}
