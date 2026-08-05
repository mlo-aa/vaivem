import type {
  Claim,
  ClaimStatus,
  DisplayCurrency,
  KycStatus,
  PixPayout,
  Quote,
  Wallet,
} from "./types"
import { currentOrg, currentUser } from "./mock-data"
import { USD_TO_BRL } from "./format"
import { isBelowMinimum, minAmountMessage } from "./limits"
import {
  authAdapter,
  etherfuseAdapter,
  randomStellarAddress,
  randomToken,
  randomTxHash,
  stellarAdapter,
} from "./adapters"

export const QUOTE_TTL_MS = 120_000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function apiBase() {
  return process.env.NEXT_PUBLIC_VAIVEM_API_BASE ?? ""
}

export interface CreateClaimInput {
  amount: number
  displayCurrency: DisplayCurrency
  /** Precomputed USDC to lock — must match the wizard display. */
  fundingUsdc?: number
  recipientCountry: string
  purpose: string
  reference?: string
  message?: string
  protectionType: "public" | "email" | "code"
  recipientName: string
  recipientEmail?: string
  recipientPhone?: string
  accessCode?: string
  expirationDays: number
  allowStellar: boolean
  allowPix: boolean
}

/** API list/detail row → Claim UI model */
export function mapApiClaim(row: Record<string, unknown>): Claim {
  const token = String(row.token)
  const amount = Number(row.amount)
  const displayAmount = Number(row.displayAmount ?? amount)
  const displayCurrency = (row.displayCurrency === "USD" ? "USD" : "BRL") as DisplayCurrency
  return {
    id: `clm_${token}`,
    token,
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: String(row.recipientName ?? ""),
    recipientEmail: row.recipientEmail != null ? String(row.recipientEmail) : null,
    recipientCountry: String(row.country ?? "BR"),
    amount,
    displayCurrency,
    displayAmount,
    asset: "USDC",
    status: (row.status as ClaimStatus) ?? "shared",
    kycStatus: "not_started",
    protectionType: (row.protectionType as Claim["protectionType"]) ?? "public",
    expiresAt: String(
      row.expiresAt ?? new Date(Number(row.deadline) * 1000).toISOString(),
    ),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    claimedAt: row.claimedAt != null ? String(row.claimedAt) : null,
    payoutMethod: (row.payoutMethod as Claim["payoutMethod"]) ?? null,
    message: row.message != null ? String(row.message) : null,
    purpose: String(row.purpose ?? "Payout"),
    reference: row.reference != null ? String(row.reference) : null,
    stellarTransactionHash: row.txHash != null ? String(row.txHash) : null,
    withdrawalReference: row.payoutOrderId != null ? String(row.payoutOrderId) : null,
  }
}

export async function getFundingUsdc(
  amount: number,
  displayCurrency: DisplayCurrency,
): Promise<number> {
  await delay(400)
  const rate = displayCurrency === "BRL" ? USD_TO_BRL : 1
  const usdc = displayCurrency === "BRL" ? amount / rate : amount
  return Math.round(usdc * 100) / 100
}

export async function getPixQuote(usdc: number, country: "BR" | "MX" = "BR"): Promise<Quote> {
  if (isBelowMinimum(usdc)) {
    throw new Error(minAmountMessage(country === "MX" ? "MXN" : "BRL"))
  }
  const res = await fetch(`${apiBase()}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: usdc, country }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.message ?? data?.error ?? "Quote request failed")
  }
  return data as Quote
}

/**
 * Funds on-chain + persists server-side. USDC amount must match what the wizard displayed.
 */
export async function createClaim(
  input: CreateClaimInput,
  onStep?: (step: number) => void,
): Promise<Claim> {
  const usdc =
    input.fundingUsdc != null
      ? Math.round(input.fundingUsdc * 100) / 100
      : await getFundingUsdc(input.amount, input.displayCurrency)
  onStep?.(1)
  onStep?.(2)

  const res = await fetch(`${apiBase()}/api/claims/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: usdc,
      displayAmount: input.amount,
      displayCurrency: input.displayCurrency,
      country: input.recipientCountry,
      senderName: currentOrg.name,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail ?? null,
      message: input.message ?? null,
      protectionType: input.protectionType,
      accessCode: input.accessCode ?? null,
      expirationDays: input.expirationDays,
      purpose: input.purpose,
      reference: input.reference ?? null,
      // The server only enforces the provider minimum when PIX is on offer.
      allowPix: input.allowPix,
      allowStellar: input.allowStellar,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? data.error ?? "create claim failed")

  onStep?.(3)
  onStep?.(4)

  return {
    id: `clm_${data.token}`,
    token: String(data.token),
    senderId: currentUser.id,
    organizationId: currentOrg.id,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail ?? null,
    recipientCountry: input.recipientCountry,
    amount: usdc,
    displayCurrency: input.displayCurrency,
    displayAmount: input.amount,
    asset: "USDC",
    status: "shared",
    kycStatus: "not_started",
    protectionType: input.protectionType,
    expiresAt: new Date(Number(data.deadline) * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    claimedAt: null,
    payoutMethod: null,
    message: input.message ?? null,
    purpose: input.purpose,
    reference: input.reference ?? null,
    stellarTransactionHash: data.hash ? String(data.hash) : null,
    withdrawalReference: null,
  }
}

/** @deprecated Prefer createClaim which funds + stores in one call. */
export async function fundClaim(
  claim: Claim,
  onStep?: (step: number) => void,
): Promise<Claim> {
  const steps = 4
  for (let i = 1; i <= steps; i++) {
    await delay(400)
    onStep?.(i)
  }
  const { hash } = await stellarAdapter.lockFunds(claim.amount.toFixed(2))
  return { ...claim, status: "funded", stellarTransactionHash: hash }
}

export async function listClaims(): Promise<Claim[]> {
  const res = await fetch(`${apiBase()}/api/claims`)
  if (!res.ok) throw new Error("Failed to list claims")
  const data = await res.json()
  return (data.claims as Record<string, unknown>[]).map(mapApiClaim)
}

export async function getClaim(token: string): Promise<Claim | null> {
  const res = await fetch(
    `${apiBase()}/api/claims/by-token/${encodeURIComponent(token)}`,
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to load claim")
  const pub = await res.json()

  // Public endpoint omits dashboard fields — merge with list when available.
  try {
    const list = await listClaims()
    const full = list.find((c) => c.token.toUpperCase() === token.toUpperCase())
    if (full) return full
  } catch {
    // fall through to public shape
  }

  return mapApiClaim({
    ...pub,
    purpose: "Payout",
    recipientEmail: null,
    createdAt: new Date(Number(pub.deadline) * 1000 - 7 * 86400000).toISOString(),
    claimedAt: null,
    payoutMethod: null,
    txHash: null,
    payoutOrderId: null,
  })
}

/** Public recipient view — never includes secrets. */
export async function getPublicClaim(token: string): Promise<{
  token: string
  senderName: string
  amount: number
  country: string
  message: string | null
  status: ClaimStatus
  deadline: number
  protectionType: Claim["protectionType"]
  requiresCode: boolean
  expiresAt?: string
  recipientName?: string
} | null> {
  const res = await fetch(
    `${apiBase()}/api/claims/by-token/${encodeURIComponent(token)}`,
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to load claim")
  return res.json()
}

async function patchClaim(
  token: string,
  body: { action: string; days?: number },
): Promise<Claim> {
  const res = await fetch(
    `${apiBase()}/api/claims/by-token/${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? data.error ?? "update failed")
  return mapApiClaim(data.claim as Record<string, unknown>)
}

export async function cancelClaim(claim: Claim): Promise<Claim> {
  return patchClaim(claim.token, { action: "cancel" })
}

export async function refundClaim(claim: Claim): Promise<Claim> {
  // Server reads balanceId from the stored record — not lastBalanceId in memory.
  return patchClaim(claim.token, { action: "refund" })
}

export async function extendExpiration(claim: Claim, days: number): Promise<Claim> {
  return patchClaim(claim.token, { action: "extend", days })
}

export async function sendVerificationCode(): Promise<{ sent: true }> {
  await delay(700)
  return { sent: true }
}

export async function verifyRecipient(code: string): Promise<{ ok: boolean }> {
  await delay(700)
  return authAdapter.verifyOtp(code)
}

export interface KycInput {
  fullName: string
  taxId: string
  dateOfBirth: string
}

export async function submitKyc(
  input: KycInput,
  onStep?: (step: number) => void,
): Promise<{ status: KycStatus }> {
  const steps = 3
  for (let i = 1; i <= steps; i++) {
    await delay(700)
    onStep?.(i)
  }
  const digits = input.taxId.replace(/\D/g, "")
  const valid = (digits.length === 11 || digits.length === 14) && !/^0+$/.test(digits)
  return { status: valid ? "approved" : "rejected" }
}

export async function createEmbeddedWallet(
  onStep?: (step: number) => void,
): Promise<Wallet> {
  const steps = 4
  for (let i = 1; i <= steps; i++) {
    await delay(750)
    onStep?.(i)
  }
  const { address } = await stellarAdapter.createSponsoredAccount()
  return {
    id: `wal_${randomToken().toLowerCase()}`,
    userId: "usr_recipient",
    stellarAddress: address || randomStellarAddress(),
    usdcBalance: 0,
    sponsored: true,
    createdAt: new Date().toISOString(),
  }
}

export async function claimToWallet(wallet: Wallet, amount: number): Promise<Wallet> {
  await delay(800)
  void amount
  return { ...wallet, usdcBalance: wallet.usdcBalance + amount }
}

export interface PixWithdrawalInput {
  fullName: string
  cpf: string
  pixKeyType: PixPayout["pixKeyType"]
  pixKey: string
  amountUSDC: number
}

export async function initiatePixWithdrawal(
  input: PixWithdrawalInput,
  quote: Quote,
  onStep?: (step: number) => void,
): Promise<PixPayout> {
  const steps = 4
  for (let i = 1; i <= steps; i++) {
    await delay(850)
    onStep?.(i)
  }
  const { reference } = await etherfuseAdapter.createPixOrder(input.amountUSDC)
  return {
    id: `pxo_${randomToken().toLowerCase()}`,
    claimId: "clm_demo",
    cpf: input.cpf,
    pixKeyType: input.pixKeyType,
    maskedPixKey: input.pixKey,
    amountBRL: Number(quote.destinationAmount),
    amountUSDC: input.amountUSDC,
    exchangeRate: Number(quote.exchangeRate),
    fee: Number(quote.feeAmount),
    status: "completed",
    provider: "Etherfuse",
    reference,
    createdAt: new Date().toISOString(),
  }
}

export async function getWithdrawalStatus(): Promise<PixPayout["status"]> {
  await delay(400)
  return "completed"
}

export function mockApiResponse(amount: string) {
  const token = randomToken()
  return {
    id: `clm_${token}`,
    token,
    status: "funded",
    amount: { asset: "USDC", value: amount },
    claimUrl: `https://vaivem.app/br/${token}`,
    stellarTransactionHash: randomTxHash(),
    createdAt: new Date().toISOString(),
  }
}
