/**
 * Edge-safe signed session cookie for sender email-code auth.
 */

const COOKIE_NAME = "vaivem_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export { COOKIE_NAME, MAX_AGE_SECONDS }

export interface SessionPayload {
  email: string
  exp: number
}

type GlobalAuth = typeof globalThis & { __vaivemAuthSecret?: string }

export class AuthSecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthSecretError"
  }
}

/** True when AUTH_SECRET is present (required on Vercel / production). */
export function hasAuthSecret(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length > 0)
}

function requiresAuthSecret(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV)
  )
}

function getSecret(): string {
  const fromEnv = process.env.AUTH_SECRET
  if (fromEnv && fromEnv.length > 0) return fromEnv

  if (requiresAuthSecret()) {
    throw new AuthSecretError(
      "[auth] AUTH_SECRET is required in production. Set it in the Vercel project Environment Variables (Production + Preview) and redeploy.",
    )
  }

  const g = globalThis as GlobalAuth
  if (!g.__vaivemAuthSecret) {
    g.__vaivemAuthSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`
    console.warn(
      "[auth] AUTH_SECRET is unset. Using an ephemeral per-process secret. " +
        "Set AUTH_SECRET in apps/web/.env.local so Edge middleware and Node API routes share the same signing key.",
    )
  }
  return g.__vaivemAuthSecret
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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function createSessionToken(email: string): Promise<string> {
  const payload: SessionPayload = {
    email: normalizeEmail(email),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  }
  const payloadB64 = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  const signature = await sign(payloadB64, getSecret())
  return `${payloadB64}.${signature}`
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null
  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null
  const expected = await sign(payloadB64, getSecret())
  if (expected.length !== signature.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i)! ^ signature.charCodeAt(i)!
  }
  if (diff !== 0) return null
  try {
    const json = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadB64)),
    ) as SessionPayload
    if (!json.email || !json.exp || json.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return { email: normalizeEmail(json.email), exp: json.exp }
  } catch {
    return null
  }
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
