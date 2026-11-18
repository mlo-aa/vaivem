import "server-only"

import { createHmac } from "node:crypto"
import { safeEqual } from "@/lib/server/rate-limit"

const PREFIX = "hmac:"

function pepper(): string {
  return process.env.AUTH_SECRET || "vaivem-dev-access-code"
}

/** Stored form of a claim access code (never keep the plaintext). */
export function hashAccessCode(code: string): string {
  return PREFIX + createHmac("sha256", pepper()).update(code).digest("hex")
}

/** Verifies a submitted code; still accepts legacy plaintext records. */
export function verifyAccessCode(stored: string | null, submitted: unknown): boolean {
  if (!stored || typeof submitted !== "string" || !submitted) return false
  if (stored.startsWith(PREFIX)) return safeEqual(stored, hashAccessCode(submitted))
  return safeEqual(stored, submitted)
}
