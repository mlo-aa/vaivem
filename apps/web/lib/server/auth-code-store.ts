import "server-only"

import { kv } from "@vercel/kv"
import { normalizeEmail } from "@/lib/dashboard-session"

const CODE_PREFIX = "auth-code:"
const RATE_PREFIX = "auth-rate:"
const CODE_TTL_SECONDS = 10 * 60
const MAX_REQUESTS_PER_WINDOW = 3
const MAX_VERIFY_ATTEMPTS = 5

export interface AuthCodeRecord {
  code: string
  attempts: number
  createdAt: string
}

const memoryCodes = new Map<string, AuthCodeRecord>()
const memoryRates = new Map<string, { count: number; expiresAt: number }>()

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function codeKey(email: string) {
  return `${CODE_PREFIX}${normalizeEmail(email)}`
}

function rateKey(email: string) {
  return `${RATE_PREFIX}${normalizeEmail(email)}`
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function getRateCount(email: string): Promise<number> {
  if (kvConfigured()) {
    const n = await kv.get<number>(rateKey(email))
    return typeof n === "number" ? n : 0
  }
  const row = memoryRates.get(normalizeEmail(email))
  if (!row || row.expiresAt < Date.now()) {
    memoryRates.delete(normalizeEmail(email))
    return 0
  }
  return row.count
}

async function bumpRate(email: string): Promise<number> {
  if (kvConfigured()) {
    const key = rateKey(email)
    const next = await kv.incr(key)
    if (next === 1) {
      await kv.expire(key, CODE_TTL_SECONDS)
    }
    return next
  }
  const e = normalizeEmail(email)
  const existing = memoryRates.get(e)
  if (!existing || existing.expiresAt < Date.now()) {
    memoryRates.set(e, {
      count: 1,
      expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
    })
    return 1
  }
  existing.count += 1
  memoryRates.set(e, existing)
  return existing.count
}

export async function createAuthCode(email: string): Promise<
  | { ok: true; code: string }
  | { ok: false; error: "rate_limited" }
> {
  const count = await getRateCount(email)
  if (count >= MAX_REQUESTS_PER_WINDOW) {
    return { ok: false, error: "rate_limited" }
  }
  await bumpRate(email)

  const record: AuthCodeRecord = {
    code: generateCode(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  }

  if (kvConfigured()) {
    await kv.set(codeKey(email), record, { ex: CODE_TTL_SECONDS })
  } else {
    memoryCodes.set(normalizeEmail(email), record)
  }
  return { ok: true, code: record.code }
}

export async function verifyAuthCode(
  email: string,
  code: string,
): Promise<
  | { ok: true }
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" }
> {
  const e = normalizeEmail(email)
  const submitted = code.replace(/\D/g, "").slice(0, 6)

  let record: AuthCodeRecord | null = null
  if (kvConfigured()) {
    record = (await kv.get<AuthCodeRecord>(codeKey(e))) ?? null
  } else {
    record = memoryCodes.get(e) ?? null
  }

  if (!record) return { ok: false, error: "expired" }

  const ageMs = Date.now() - new Date(record.createdAt).getTime()
  if (!Number.isFinite(ageMs) || ageMs > CODE_TTL_SECONDS * 1000) {
    await deleteAuthCode(e)
    return { ok: false, error: "expired" }
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await deleteAuthCode(e)
    return { ok: false, error: "too_many_attempts" }
  }

  if (record.code !== submitted) {
    const next: AuthCodeRecord = {
      ...record,
      attempts: record.attempts + 1,
    }
    if (next.attempts >= MAX_VERIFY_ATTEMPTS) {
      await deleteAuthCode(e)
      return { ok: false, error: "too_many_attempts" }
    }
    if (kvConfigured()) {
      const ttl = await kv.ttl(codeKey(e))
      await kv.set(codeKey(e), next, {
        ex: ttl > 0 ? ttl : CODE_TTL_SECONDS,
      })
    } else {
      memoryCodes.set(e, next)
    }
    return { ok: false, error: "invalid" }
  }

  await deleteAuthCode(e)
  return { ok: true }
}

export async function deleteAuthCode(email: string): Promise<void> {
  const e = normalizeEmail(email)
  if (kvConfigured()) {
    await kv.del(codeKey(e))
    return
  }
  memoryCodes.delete(e)
}

export { MAX_REQUESTS_PER_WINDOW, MAX_VERIFY_ATTEMPTS, CODE_TTL_SECONDS }
