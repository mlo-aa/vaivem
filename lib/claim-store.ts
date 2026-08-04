"use client"

import type { Claim } from "./types"
import { claims as seedClaims } from "./mock-data"

// Client-side claim store for the demo. Seed claims are always available;
// claims created through the wizard are added here (and mirrored to
// sessionStorage) so the detail route can resolve freshly minted tokens
// without a persistent backend.
const SESSION_KEY = "vaivem.created-claims"

function readSession(): Claim[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Claim[]) : []
  } catch {
    return []
  }
}

function writeSession(list: Claim[]) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(list))
  } catch {
    // ignore quota / serialization errors in the demo
  }
}

export function saveClaim(claim: Claim) {
  const list = readSession().filter((c) => c.token !== claim.token)
  list.unshift(claim)
  writeSession(list)
}

export function getAllClaims(): Claim[] {
  // Session-created claims first, then seed data.
  return [...readSession(), ...seedClaims]
}

// Mark a claim as viewed (recipient opened the link) if it hasn't progressed.
export function markViewed(token: string) {
  const claim = findClaim(token)
  if (claim && claim.status === "shared") {
    saveClaim({ ...claim, status: "viewed" })
  }
}

export function findClaim(token: string): Claim | null {
  const lower = token.toLowerCase()
  return getAllClaims().find((c) => c.token.toLowerCase() === lower) ?? null
}

// Resolve a claim for the public recipient flow. Unknown or "demo" tokens
// fall back to a representative claimable (shared) claim so shared demo links
// always land somewhere meaningful.
export function findClaimableClaim(token: string): Claim | null {
  const exact = findClaim(token)
  if (exact) return exact
  const all = getAllClaims()
  const shared = all.find((c) => c.status === "shared") ?? all.find((c) => c.status === "viewed")
  return shared ?? null
}
