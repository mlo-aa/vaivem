/**
 * Poll Horizon for USDC payments to the sponsor that carry this sender's
 * memo.hash, and credit the demo ledger (type deposit_usdc, ref = tx hash).
 */

import "server-only"

import {
  ETHERFUSE_USDC_ISSUER,
  getEtherfuseUsdcCodeIssuer,
  getHorizonServer,
  getSponsorPublicKey,
} from "@/lib/server/stellar"
import { creditUsdcDeposit } from "@/lib/server/balance-store"
import {
  ownerDepositMemoBase64,
  ownerDepositMemoHex,
} from "@/lib/server/deposit-memo"

export type CreditedUsdcDeposit = {
  txHash: string
  amount: number
}

function normalizeMemoToBase64(raw: string | undefined | null): string {
  if (!raw) return ""
  const t = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(t)) {
    return Buffer.from(t, "hex").toString("base64")
  }
  return t
}

function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Scan recent payments to the sponsor for matching memo + Etherfuse USDC.
 * Idempotent via creditUsdcDeposit (tx hash).
 */
export async function reconcileUsdcDeposits(
  ownerId: string,
): Promise<CreditedUsdcDeposit[]> {
  const sponsor = getSponsorPublicKey()
  const expectedMemoB64 = ownerDepositMemoBase64(ownerId)
  const expectedMemoHex = ownerDepositMemoHex(ownerId).toLowerCase()
  const { code: assetCode, issuer: assetIssuer } = getEtherfuseUsdcCodeIssuer()
  const allowedIssuer = (assetIssuer || ETHERFUSE_USDC_ISSUER).toUpperCase()

  const server = getHorizonServer()
  const credited: CreditedUsdcDeposit[] = []

  let page
  try {
    page = await server
      .payments()
      .forAccount(sponsor)
      .order("desc")
      .limit(50)
      .join("transactions")
      .call()
  } catch (err) {
    console.error(
      "[reconcile-usdc] payments list failed:",
      err instanceof Error ? err.message : err,
    )
    return credited
  }

  for (const record of page.records ?? []) {
    if (record.type !== "payment") continue
    if (record.to !== sponsor) continue
    if (record.asset_type === "native") continue
    if (String(record.asset_code ?? "").toUpperCase() !== assetCode.toUpperCase()) {
      continue
    }
    const issuer = String(record.asset_issuer ?? "").toUpperCase()
    if (issuer !== allowedIssuer) continue

    const txHash = String(record.transaction_hash ?? "")
    if (!txHash) continue

    let memoType: string | undefined
    let memo: string | undefined
    const embedded = (
      record as {
        transaction?:
          | { memo_type?: string; memo?: string }
          | (() => Promise<{ memo_type?: string; memo?: string }>)
      }
    ).transaction
    try {
      if (typeof embedded === "function") {
        const tx = await embedded()
        memoType = tx.memo_type
        memo = tx.memo
      } else if (embedded && typeof embedded === "object") {
        memoType = embedded.memo_type
        memo = embedded.memo
      } else {
        const tx = await server.transactions().transaction(txHash).call()
        memoType = tx.memo_type
        memo = tx.memo
      }
    } catch {
      continue
    }

    if (memoType !== "hash") continue
    const got = normalizeMemoToBase64(memo)
    let matches = got === expectedMemoB64
    if (!matches) {
      try {
        matches =
          Buffer.from(got, "base64").toString("hex").toLowerCase() ===
          expectedMemoHex
      } catch {
        matches = false
      }
    }
    if (!matches) continue

    const amount = roundUsdc(Number(record.amount))
    if (!Number.isFinite(amount) || amount <= 0) continue

    const result = await creditUsdcDeposit(ownerId, amount, txHash)
    if (result.newlyCredited) {
      credited.push({ txHash, amount })
    }
  }

  return credited
}
