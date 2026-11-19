import "server-only"

/**
 * Public demo mode: anyone can open the app with one click, on Stellar testnet.
 * Demo users are ordinary owners whose id ends with @demo.vaivem, so every
 * restriction below is a cheap suffix check — real users are never affected.
 *
 * The limits exist to protect the shared testnet sponsor wallet from being
 * drained by strangers; they are all overridable with env vars.
 */

export const DEMO_EMAIL_DOMAIN = "demo.vaivem"

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function demoConfig() {
  return {
    enabled: process.env.DEMO_LOGIN !== "off",
    /** Test balance credited to each new demo session (USDC). */
    startBalance: num(process.env.DEMO_START_BALANCE, 10),
    maxClaimUsdc: num(process.env.DEMO_MAX_CLAIM_USDC, 5),
    maxClaims: num(process.env.DEMO_MAX_CLAIMS, 3),
    perIpPerDay: num(process.env.DEMO_PER_IP_DAILY, 3),
    globalPerDay: num(process.env.DEMO_GLOBAL_DAILY, 60),
  }
}

export function isDemoOwner(ownerId: string | null | undefined): boolean {
  return Boolean(ownerId) && ownerId!.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}
