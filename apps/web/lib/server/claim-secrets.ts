/**
 * lib/server/claim-secrets.ts
 *
 * Recipient secrets for sponsored claimable balances.
 * NEVER expose these values to the client.
 *
 * Uses Vercel KV when KV_REST_API_URL + KV_REST_API_TOKEN are set (production).
 * Falls back to an in-memory Map for local dev without KV.
 */

import "server-only"

import { kv } from "@vercel/kv"

const KEY_PREFIX = "claim-secret:"
const HOUR_SECONDS = 60 * 60
/** Fallback TTL when deadline is omitted (default claim window 300s + 1h). */
const DEFAULT_TTL_SECONDS = 300 + HOUR_SECONDS

const memory = new Map<string, string>()

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function keyFor(balanceId: string) {
  return `${KEY_PREFIX}${balanceId}`
}

function ttlFromDeadline(deadlineUnixSeconds?: number): number {
  if (deadlineUnixSeconds == null || !Number.isFinite(deadlineUnixSeconds)) {
    return DEFAULT_TTL_SECONDS
  }
  const ttl = Math.floor(deadlineUnixSeconds + HOUR_SECONDS - Date.now() / 1000)
  return Math.max(ttl, 60)
}

/**
 * Map-shaped store: same method names routes already call (.set / .get / .delete).
 * Methods are async because KV is remote — callers must await.
 */
export const recipientSecretsByBalanceId = {
  async set(
    balanceId: string,
    secret: string,
    deadlineUnixSeconds?: number,
  ): Promise<void> {
    if (kvConfigured()) {
      await kv.set(keyFor(balanceId), secret, {
        ex: ttlFromDeadline(deadlineUnixSeconds),
      })
      return
    }
    memory.set(balanceId, secret)
  },

  async get(balanceId: string): Promise<string | undefined> {
    if (kvConfigured()) {
      const value = await kv.get<string>(keyFor(balanceId))
      return value ?? undefined
    }
    return memory.get(balanceId)
  },

  async delete(balanceId: string): Promise<void> {
    if (kvConfigured()) {
      await kv.del(keyFor(balanceId))
      return
    }
    memory.delete(balanceId)
  },
}
