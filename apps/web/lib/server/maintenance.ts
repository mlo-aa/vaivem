/**
 * Scheduled maintenance (called by the cron route):
 *  1. Expired, unclaimed claims → sponsor reclaims the escrow, sender is credited.
 *  2. Claims stuck in cashing_out that have a provider order → reconcile.
 *
 * Each claim runs under the same per-claim lock the settlement route uses, so a
 * recipient settling at the deadline cannot race the refund.
 */

import "server-only"

import { refundExpiredBalance, StellarError } from "@/lib/server/stellar"
import { recipientSecretsByBalanceId } from "@/lib/server/claim-secrets"
import { listAllStoredClaims, updateStoredClaim } from "@/lib/server/claim-store"
import { creditRefund } from "@/lib/server/balance-store"
import { reconcileClaimPayout } from "@/lib/server/reconcile-claim"
import { tryLock } from "@/lib/server/rate-limit"

export type MaintenanceReport = {
  scanned: number
  refunded: string[]
  reconciled: string[]
  skipped: string[]
  errors: { token: string; error: string }[]
}

const REFUNDABLE = new Set(["shared", "viewed", "funded"])

export async function runMaintenance(now = Date.now()): Promise<MaintenanceReport> {
  const report: MaintenanceReport = {
    scanned: 0,
    refunded: [],
    reconciled: [],
    skipped: [],
    errors: [],
  }
  const claims = await listAllStoredClaims()
  report.scanned = claims.length
  const nowSec = Math.floor(now / 1000)

  for (const claim of claims) {
    const release = await tryLock(`claim:${claim.token}`, 120)
    if (!release) {
      report.skipped.push(claim.token)
      continue
    }
    try {
      if (claim.status === "cashing_out" && claim.payoutOrderId) {
        const after = await reconcileClaimPayout(claim)
        if (after.status !== claim.status) report.reconciled.push(claim.token)
        continue
      }

      // +60s margin so we never race the on-chain deadline clock.
      if (REFUNDABLE.has(claim.status) && claim.deadline + 60 < nowSec) {
        try {
          await refundExpiredBalance(claim.balanceId)
        } catch (err) {
          const gone =
            err instanceof StellarError &&
            (err.resultCodes?.operations ?? []).some((o) => o === "op_does_not_exist")
          if (!gone) throw err
          // Escrow no longer exists (already claimed or refunded): do NOT credit again.
          await updateStoredClaim(claim.token, { status: "expired" })
          report.skipped.push(claim.token)
          continue
        }
        await recipientSecretsByBalanceId.delete(claim.balanceId)
        await updateStoredClaim(claim.token, { status: "expired" })
        if (claim.ownerId && claim.amount > 0) {
          await creditRefund(claim.ownerId, claim.amount, claim.token)
        }
        report.refunded.push(claim.token)
      }
    } catch (err) {
      report.errors.push({
        token: claim.token,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      await release()
    }
  }
  return report
}
