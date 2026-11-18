/**
 * Small atomic primitives shared by auth + claim routes.
 *  - hit():     fixed-window counter (KV INCR / in-memory).
 *  - tryLock(): non-blocking mutex (KV SET NX / in-memory) with TTL.
 */

import "server-only"

import { kv } from "@vercel/kv"
import { createHash, timingSafeEqual } from "node:crypto"

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

const memoryCounters = new Map<string, { count: number; expiresAt: number }>()
const memoryLocks = new Map<string, number>()

/** Count one attempt. `ok` is false once `limit` is exceeded in the window. */
export async function hit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; count: number }> {
  const k = `rl:${key}`
  if (kvConfigured()) {
    const count = await kv.incr(k)
    if (count === 1) await kv.expire(k, windowSeconds)
    return { ok: count <= limit, count }
  }
  const now = Date.now()
  const row = memoryCounters.get(k)
  if (!row || row.expiresAt < now) {
    memoryCounters.set(k, { count: 1, expiresAt: now + windowSeconds * 1000 })
    return { ok: 1 <= limit, count: 1 }
  }
  row.count += 1
  return { ok: row.count <= limit, count: row.count }
}

export async function resetHits(key: string): Promise<void> {
  const k = `rl:${key}`
  if (kvConfigured()) await kv.del(k)
  else memoryCounters.delete(k)
}

/** Returns a release function, or null if someone else holds the lock. */
export async function tryLock(
  key: string,
  ttlSeconds: number,
): Promise<(() => Promise<void>) | null> {
  const k = `lock:${key}`
  if (kvConfigured()) {
    const holder = crypto.randomUUID()
    const ok = await kv.set(k, holder, { nx: true, ex: ttlSeconds })
    if (!ok) return null
    return async () => {
      try {
        if ((await kv.get<string>(k)) === holder) await kv.del(k)
      } catch {
        /* TTL frees it */
      }
    }
  }
  const now = Date.now()
  const until = memoryLocks.get(k)
  if (until && until > now) return null
  const mine = now + ttlSeconds * 1000
  memoryLocks.set(k, mine)
  return async () => {
    if (memoryLocks.get(k) === mine) memoryLocks.delete(k)
  }
}

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown"
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

/** Constant-time string equality. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}
