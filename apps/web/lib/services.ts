import type {
  Claim,
  ClaimStatus,
  DisplayCurrency,
} from "./types"
import { USD_TO_BRL } from "./format"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function apiBase() {
  return process.env.NEXT_PUBLIC_VAIVEM_API_BASE ?? ""
}

function randomTxHash(): string {
  const chars = "abcdef0123456789"
  return Array.from({ length: 64 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("")
}

function randomToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("")
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
  const ownerId = String(row.ownerId ?? "")
  return {
    id: `clm_${token}`,
    token,
    senderId: ownerId,
    organizationId: ownerId,
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

/**
 * Funds on-chain + persists server-side. USDC amount must match what the wizard displayed.
 * Sender name comes from the authenticated session on the server — not from the client.
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
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail ?? null,
      message: input.message ?? null,
      protectionType: input.protectionType,
      accessCode: input.accessCode ?? null,
      expirationDays: input.expirationDays,
      purpose: input.purpose,
      reference: input.reference ?? null,
      allowPix: input.allowPix,
      allowStellar: input.allowStellar,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? data.error ?? "create claim failed")

  onStep?.(3)
  onStep?.(4)

  const ownerId = String(data.ownerId ?? "")
  return {
    id: `clm_${data.token}`,
    token: String(data.token),
    senderId: ownerId,
    organizationId: ownerId,
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

export async function listClaims(): Promise<Claim[]> {
  const res = await fetch(`${apiBase()}/api/claims`)
  if (!res.ok) throw new Error("Failed to list claims")
  const data = await res.json()
  return (data.claims as Record<string, unknown>[]).map(mapApiClaim)
}

export async function getClaim(token: string): Promise<Claim | null> {
  const list = await listClaims()
  return list.find((c) => c.token.toUpperCase() === token.toUpperCase()) ?? null
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
  displayCurrency?: "BRL" | "USD"
  displayAmount?: number
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
  return patchClaim(claim.token, { action: "refund" })
}

export async function extendExpiration(claim: Claim, days: number): Promise<Claim> {
  return patchClaim(claim.token, { action: "extend", days })
}

/** Fake /v1 response for the developers playground only. */
export function mockApiResponse(amount: string) {
  const token = randomToken()
  return {
    id: `clm_${token}`,
    token,
    status: "funded",
    amount: { asset: "USDC", value: amount },
    claimUrl: `http://localhost:3000/claim/${token}`,
    stellarTransactionHash: randomTxHash(),
    createdAt: new Date().toISOString(),
  }
}
