/**
 * lib/server/claim-store.ts
 *
 * Persisted claim records (metadata + balanceId). Secrets stay in claim-secrets.
 * KV when configured; in-memory Map otherwise.
 */

import "server-only"

import { kv } from "@vercel/kv"
import type { ClaimStatus, PayoutMethod, ProtectionType } from "@/lib/types"

const KEY_PREFIX = "claim:"
const INDEX_KEY = "claims:index"
const OWNER_INDEX_PREFIX = "claims:owner:"
const DAY_SECONDS = 24 * 60 * 60

/** 8-char uppercase base32 excluding 0/O/1/I */
const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export interface StoredClaim {
  token: string
  /** Auth.js user id (or local-dev). Scopes the dashboard list. */
  ownerId: string
  balanceId: string
  recipientPublicKey: string
  amount: number
  country: string
  senderName: string
  recipientName: string
  recipientEmail: string | null
  message: string | null
  protectionType: ProtectionType
  accessCode: string | null
  status: ClaimStatus
  deadline: number
  createdAt: string
  claimedAt: string | null
  payoutMethod: PayoutMethod
  payoutOrderId: string | null
  txHash: string | null
  displayCurrency?: "BRL" | "USD"
  displayAmount?: number
  purpose?: string
  reference?: string | null
  expiresAt?: string
  /** Present when created via CSV batch. */
  batchId?: string | null
}

/** Public fields safe for the recipient unlock page. */
export type PublicClaim = Pick<
  StoredClaim,
  | "token"
  | "senderName"
  | "amount"
  | "country"
  | "message"
  | "status"
  | "deadline"
  | "protectionType"
  | "displayCurrency"
  | "displayAmount"
  | "recipientName"
  | "expiresAt"
> & {
  requiresCode: boolean
}

const memory = new Map<string, StoredClaim>()
const memoryIndex = new Set<string>()
const memoryOwnerIndex = new Map<string, Set<string>>()

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function keyFor(token: string) {
  return `${KEY_PREFIX}${token.toUpperCase()}`
}

function ownerIndexKey(ownerId: string) {
  return `${OWNER_INDEX_PREFIX}${ownerId}`
}

async function addOwnerIndex(ownerId: string, token: string): Promise<void> {
  if (!ownerId) return
  if (kvConfigured()) {
    await kv.sadd(ownerIndexKey(ownerId), token)
    return
  }
  const set = memoryOwnerIndex.get(ownerId) ?? new Set<string>()
  set.add(token)
  memoryOwnerIndex.set(ownerId, set)
}

function ttlFromDeadline(deadlineUnixSeconds: number): number {
  const ttl = Math.floor(deadlineUnixSeconds + DAY_SECONDS - Date.now() / 1000)
  return Math.max(ttl, 60)
}

export function generateClaimToken(): string {
  return Array.from({ length: 8 }, () =>
    TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)],
  ).join("")
}

export async function saveStoredClaim(claim: StoredClaim): Promise<void> {
  const token = claim.token.toUpperCase()
  const record = { ...claim, token, ownerId: claim.ownerId || "" }
  if (kvConfigured()) {
    await kv.set(keyFor(token), record, { ex: ttlFromDeadline(claim.deadline) })
    await kv.sadd(INDEX_KEY, token)
    if (record.ownerId) await addOwnerIndex(record.ownerId, token)
    return
  }
  memory.set(token, record)
  memoryIndex.add(token)
  if (record.ownerId) await addOwnerIndex(record.ownerId, token)
}

export async function getStoredClaim(token: string): Promise<StoredClaim | null> {
  const t = token.toUpperCase()
  const raw = kvConfigured()
    ? await kv.get<StoredClaim>(keyFor(t))
    : memory.get(t) ?? null
  if (!raw) return null
  return { ...raw, ownerId: raw.ownerId ?? "" }
}

/** Claims owned by a single sender. */
export async function listStoredClaimsByOwner(ownerId: string): Promise<StoredClaim[]> {
  if (!ownerId) return []
  if (kvConfigured()) {
    const tokens = (await kv.smembers(ownerIndexKey(ownerId))) as string[]
    const claims: StoredClaim[] = []
    for (const t of tokens ?? []) {
      const c = await getStoredClaim(t)
      if (c && c.ownerId === ownerId) claims.push(c)
    }
    return claims.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }
  const tokens = memoryOwnerIndex.get(ownerId)
  if (!tokens) {
    // Fallback for records saved before the owner index existed.
    return [...memory.values()]
      .filter((c) => c.ownerId === ownerId)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }
  const claims: StoredClaim[] = []
  for (const t of tokens) {
    const c = memory.get(t)
    if (c && c.ownerId === ownerId) claims.push(c)
  }
  return claims.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function updateStoredClaim(
  token: string,
  patch: Partial<StoredClaim>,
): Promise<StoredClaim | null> {
  const existing = await getStoredClaim(token)
  if (!existing) return null
  const next = { ...existing, ...patch, token: existing.token }
  await saveStoredClaim(next)
  return next
}

export function toPublicClaim(claim: StoredClaim): PublicClaim {
  return {
    token: claim.token,
    senderName: claim.senderName,
    amount: claim.amount,
    country: claim.country,
    message: claim.message,
    status: claim.status,
    deadline: claim.deadline,
    protectionType: claim.protectionType,
    displayCurrency: claim.displayCurrency,
    displayAmount: claim.displayAmount,
    recipientName: claim.recipientName,
    expiresAt: claim.expiresAt,
    requiresCode: claim.protectionType === "code",
  }
}
