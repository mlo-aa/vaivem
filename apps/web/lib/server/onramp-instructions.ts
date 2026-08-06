/**
 * Normalize Etherfuse on-ramp deposit instructions across MXN (SPEI) and BRL (PIX).
 * Field names verified in sandbox 2026-08-06 — POST /ramp/order returns the same
 * onramp object; BRL uses depositBankName "PIX" with empty depositClabe.
 */

import "server-only"

import type { OnrampOrderResult } from "@/lib/server/etherfuse"

export type OnrampRail = "spei" | "pix"

export type FundingDepositInstructions = {
  rail: OnrampRail
  depositAmount: string
  depositBankName: string
  depositAccountHolder: string
  /** MXN SPEI CLABE when present. */
  depositClabe?: string
  /** Etherfuse sandbox payment page (observed on GET /ramp/order for BRL). */
  statusPage?: string
  /** Any extra string the provider adds later (e.g. Pix copia-e-cola). */
  pixCopyPaste?: string
}

const PIX_COPY_KEYS = [
  "depositPixCopyPaste",
  "pixCopyPaste",
  "pixCopiaECola",
  "pixQrCode",
  "pixEmv",
  "brCode",
  "emv",
] as const

function pickPixCopyPaste(raw: Record<string, unknown>): string | undefined {
  for (const key of PIX_COPY_KEYS) {
    const val = raw[key]
    if (typeof val === "string" && val.trim().length > 0) return val.trim()
  }
  return undefined
}

export function normalizeOnrampInstructions(
  onramp: OnrampOrderResult["onramp"],
  currency: "MXN" | "BRL",
  statusPage?: string,
): FundingDepositInstructions {
  const raw = onramp as Record<string, unknown>
  const bankName = String(onramp.depositBankName ?? "")
  const rail: OnrampRail =
    currency === "BRL" || bankName.toUpperCase() === "PIX" ? "pix" : "spei"

  return {
    rail,
    depositAmount: String(onramp.depositAmount ?? ""),
    depositBankName: bankName,
    depositAccountHolder: String(onramp.depositAccountHolder ?? ""),
    ...(onramp.depositClabe ? { depositClabe: onramp.depositClabe } : {}),
    ...(statusPage ? { statusPage } : {}),
    ...(pickPixCopyPaste(raw) ? { pixCopyPaste: pickPixCopyPaste(raw) } : {}),
  }
}
