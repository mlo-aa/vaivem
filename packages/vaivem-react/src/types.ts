/** Shared kit types — mirror of the Vaivém domain surface used by the UI. */

export type KycStatus = "not_started" | "pending" | "approved" | "rejected"

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random"

/** Settlement provider behind the quote. */
export type RampProvider = "etherfuse" | "mock"

export interface Quote {
  quoteId: string
  sourceAmount: string
  destinationAmount: string
  exchangeRate: string
  etherfuseMidMarketRate: string
  nominalRate: string
  feeBps: string
  feeAmount: string
  requiresSwap: boolean
  createdAt: string
  expiresAt: string
  currency: string
  source: "live" | "mock"
  note?: string
}
