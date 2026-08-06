/**
 * Shared-password dashboard session.
 * Edge-safe (no Node APIs) so middleware and route handlers can both use it.
 */

const COOKIE_NAME = "vaivem_dash"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export { COOKIE_NAME, MAX_AGE_SECONDS }

function getPassword(): string | undefined {
  const value = process.env.DASHBOARD_PASSWORD
  return value && value.length > 0 ? value : undefined
}

export function dashboardAuthConfigured(): boolean {
  return Boolean(getPassword())
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!)
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary")
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function sign(payloadB64: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  )
  return bytesToBase64Url(sig)
}

/** Create a signed session cookie value. */
export async function createSessionToken(): Promise<string | null> {
  const password = getPassword()
  if (!password) return null
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }),
    ),
  )
  const signature = await sign(payload, password)
  return `${payload}.${signature}`
}

/** Verify a signed session cookie value. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const password = getPassword()
  if (!password) return true // auth disabled
  if (!token) return false
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false
  const expected = await sign(payload, password)
  if (expected.length !== signature.length) return false
  // Constant-time-ish compare
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i)! ^ signature.charCodeAt(i)!
  }
  if (diff !== 0) return false
  try {
    const json = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as {
      exp?: number
    }
    if (!json.exp || json.exp < Math.floor(Date.now() / 1000)) return false
    return true
  } catch {
    return false
  }
}

export function passwordMatches(candidate: string): boolean {
  const password = getPassword()
  if (!password) return true
  return candidate === password
}

export function sessionCookieOptions(maxAge = MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}
