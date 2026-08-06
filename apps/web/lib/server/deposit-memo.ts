/**
 * Per-sender Stellar memo for crypto USDC deposits.
 * Memo.hash(sha256(ownerId)) so Horizon payments can be attributed.
 */

import "server-only"

import { createHash } from "node:crypto"

/** 32-byte SHA-256 of ownerId — Stellar Memo.hash payload. */
export function ownerDepositMemoBytes(ownerId: string): Buffer {
  return createHash("sha256").update(ownerId, "utf8").digest()
}

/** Hex form for UI / wallet paste (64 chars). */
export function ownerDepositMemoHex(ownerId: string): string {
  return ownerDepositMemoBytes(ownerId).toString("hex")
}

/** Base64 form as returned by Horizon for memo_type=hash. */
export function ownerDepositMemoBase64(ownerId: string): string {
  return ownerDepositMemoBytes(ownerId).toString("base64")
}
